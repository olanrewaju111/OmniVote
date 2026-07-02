package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"nhooyr.io/websocket"

	_ "github.com/mattn/go-sqlite3"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	waProto "go.mau.fi/whatsmeow/binary/proto/armadillo"
	"google.golang.org/protobuf/proto"
)

// ─── Types ────────────────────────────────────────────────────────────

type Bridge struct {
	db       *sql.DB
	clients  map[string]*TenantClient
	mu       sync.RWMutex
	sessions string
}

type TenantClient struct {
	ID           string `json:"id"`
	TenantID     string `json:"tenantId"`
	Phone        string `json:"phone"`
	Jid          string `json:"jid,omitempty"`
	Status       string `json:"status"`
	QRCode       string `json:"qrCode,omitempty"`
	Error        string `json:"error,omitempty"`
	Client       *whatsmeow.Client
	QRChan       chan string
	ConnectedAt  string `json:"connectedAt,omitempty"`
	mu           sync.Mutex
}

type SendRequest struct {
	TenantID  string `json:"tenantId"`
	MessageID string `json:"messageId"`
	ToPhone   string `json:"toPhone"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
	Priority  string `json:"priority"`
}

type SendResponse struct {
	Success       bool   `json:"success"`
	WhatsappMsgID string `json:"whatsappMessageId,omitempty"`
	Error         string `json:"error,omitempty"`
	Timestamp     string `json:"timestamp,omitempty"`
}

// ─── Main ────────────────────────────────────────────────────────────

func main() {
	sessionsDir := getEnv("SESSIONS_DIR", "./sessions")
	os.MkdirAll(sessionsDir, 0700)

	dbPath := getEnv("DB_PATH", "../db/custom.db")
	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	bridge := &Bridge{
		db:       db,
		clients:  make(map[string]*TenantClient),
		sessions: sessionsDir,
	}

	bridge.restoreConnections()

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.Route("/api/whatsapp", func(r chi.Router) {
		r.Post("/link", bridge.handleLink)
		r.Get("/qr/{tenantId}", bridge.handleGetQR)
		r.Get("/status/{tenantId}", bridge.handleStatus)
		r.Post("/send", bridge.handleSend)
		r.Post("/disconnect/{tenantId}", bridge.handleDisconnect)
		r.Get("/tenants", bridge.handleListTenants)
		r.Post("/webhook/status", bridge.handleStatusWebhook)
	})

	r.HandleFunc("/ws/whatsapp/{tenantId}", bridge.handleWebSocket)

	port := getEnv("PORT", "9090")
	server := &http.Server{Addr: ":" + port, Handler: r}

	go func() {
		log.Printf("WhatsApp Bridge running on :%s (sessions: %s, db: %s)", port, sessionsDir, dbPath)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down WhatsApp bridge...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	bridge.mu.Lock()
	for _, tc := range bridge.clients {
		if tc.Client != nil && tc.Client.IsConnected() {
			tc.Client.Disconnect()
		}
	}
	bridge.mu.Unlock()

	server.Shutdown(ctx)
	log.Println("Bridge stopped")
}

// ─── Link ────────────────────────────────────────────────────────────

func (b *Bridge) handleLink(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string `json:"tenantId"`
		Phone     string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid JSON"})
		return
	}
	if req.TenantID == "" || req.Phone == "" {
		writeJSON(w, 400, map[string]string{"error": "tenantId and phone are required"})
		return
	}

	b.db.Exec(`UPDATE Tenant SET whatsappPhone=?, whatsappStatus='CONNECTING' WHERE id=?`,
		req.Phone, "CONNECTING", req.TenantID)

	tc, err := b.createClient(req.TenantID, req.Phone)
	if err != nil {
		b.db.Exec(`UPDATE Tenant SET whatsappStatus='FAILED' WHERE id=?`, req.TenantID)
		writeJSON(w, 500, map[string]interface{}{"error": err.Error(), "status": "FAILED"})
		return
	}

	writeJSON(w, 200, tc)
}

// ─── QR ──────────────────────────────────────────────────────────────

func (b *Bridge) handleGetQR(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	b.mu.RLock()
	tc, ok := b.clients[tenantID]
	b.mu.RUnlock()

	if !ok {
		writeJSON(w, 404, map[string]interface{}{"tenantId": tenantID, "status": "DISCONNECTED"})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"tenantId": tenantID, "status": tc.Status,
		"qrCode": tc.QRCode, "jid": tc.Jid, "phone": tc.Phone,
	})
}

// ─── Status ──────────────────────────────────────────────────────────

func (b *Bridge) handleStatus(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantID")
	b.mu.RLock()
	tc, ok := b.clients[tenantID]
	b.mu.RUnlock()

	if !ok {
		writeJSON(w, 200, map[string]interface{}{"tenantId": tenantID, "status": "DISCONNECTED"})
		return
	}
	writeJSON(w, 200, tc)
}

// ─── Send ────────────────────────────────────────────────────────────

func (b *Bridge) handleSend(w http.ResponseWriter, r *http.Request) {
	var req SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid JSON"})
		return
	}
	if req.TenantID == "" || req.ToPhone == "" || req.Body == "" {
		writeJSON(w, 400, map[string]string{"error": "tenantId, toPhone, and body are required"})
		return
	}

	b.mu.RLock()
	tc, ok := b.clients[req.TenantID]
	b.mu.RUnlock()

	if !ok || tc == nil || tc.Client == nil || !tc.Client.IsConnected() {
		writeJSON(w, 503, map[string]string{"error": "WhatsApp not connected for this tenant", "status": "DISCONNECTED"})
		return
	}

	recipientJid, err := parsePhoneToJID(req.ToPhone)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid phone: " + err.Error()})
		return
	}

	msgText := fmt.Sprintf("*%s*\n\n%s", req.Subject, req.Body)
	msgID := uuid.New().String()
	ts := time.Now()

	_, err = tc.Client.SendMessage(context.Background(), recipientJid, &waProto.Message{
		Conversation: proto.String(msgText),
	})

	resp := SendResponse{Timestamp: ts.Format(time.RFC3339)}

	if err != nil {
		resp.Success = false
		resp.Error = err.Error()
		if req.MessageID != "" {
			b.db.Exec(`UPDATE AgentMessage SET status='FAILED' WHERE id=?`, req.MessageID)
		}
		log.Printf("[%s] Send FAILED to %s: %v", req.TenantID, req.ToPhone, err)
	} else {
		resp.Success = true
		resp.WhatsappMsgID = msgID
		if req.MessageID != "" {
			b.db.Exec(`UPDATE AgentMessage SET status='SENT', whatsappMessageId=?, deliveredAt=? WHERE id=?`,
				msgID, ts.Format("2006-01-02T15:04:05Z"), req.MessageID)
		}
		log.Printf("[%s] Sent to %s: %s", req.TenantID, req.ToPhone, req.Subject)
	}

	writeJSON(w, 200, resp)
}

// ─── Disconnect ──────────────────────────────────────────────────────

func (b *Bridge) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	b.mu.Lock()
	if tc, ok := b.clients[tenantID]; ok {
		if tc.Client != nil && tc.Client.IsConnected() {
			tc.Client.Disconnect()
		}
		delete(b.clients, tenantID)
	}
	b.mu.Unlock()

	b.db.Exec(`UPDATE Tenant SET whatsappStatus='DISCONNECTED', whatsappJid=NULL, whatsappConnectedAt=NULL WHERE id=?`, tenantID)
	writeJSON(w, 200, map[string]string{"status": "DISCONNECTED"})
}

// ─── List ────────────────────────────────────────────────────────────

func (b *Bridge) handleListTenants(w http.ResponseWriter, r *http.Request) {
	rows, err := b.db.Query(`SELECT id, name, slug, COALESCE(whatsappPhone,''), COALESCE(whatsappJid,''), COALESCE(whatsappStatus,'DISCONNECTED'), COALESCE(CAST(whatsappConnectedAt AS TEXT),'') FROM Tenant WHERE isActive=1`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	type T struct {
		ID, Name, Slug, Phone, Jid, Status, ConnectedAt string
	}
	var tenants []T
	for rows.Next() {
		var t T
		rows.Scan(&t.ID, &t.Name, &t.Slug, &t.Phone, &t.Jid, &t.Status, &t.ConnectedAt)
		tenants = append(tenants, t)
	}

	b.mu.RLock()
	for i := range tenants {
		if tc, ok := b.clients[tenants[i].ID]; ok {
			tenants[i].Status = tc.Status
		}
	}
	b.mu.RUnlock()

	if tenants == nil {
		tenants = []T{}
	}
	writeJSON(w, 200, tenants)
}

// ─── Webhook ─────────────────────────────────────────────────────────

func (b *Bridge) handleStatusWebhook(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MessageID string `json:"messageId"`
		Status    string `json:"status"`
		Timestamp string `json:"timestamp"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if body.MessageID != "" && body.Status != "" {
		switch body.Status {
		case "delivered":
			b.db.Exec(`UPDATE AgentMessage SET status='DELIVERED', deliveredAt=? WHERE whatsappMessageId=?`, body.Timestamp, body.MessageID)
		case "read":
			b.db.Exec(`UPDATE AgentMessage SET status='READ', readAt=? WHERE whatsappMessageId=?`, body.Timestamp, body.MessageID)
		}
	}
	w.WriteHeader(200)
}

// ─── WebSocket ───────────────────────────────────────────────────────

func (b *Bridge) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	tenantID := strings.TrimSuffix(chi.URLParam(r, "tenantID"), "/")
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	ctx := r.Context()
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			b.mu.RLock()
			tc, ok := b.clients[tenantID]
			b.mu.RUnlock()
			payload := map[string]interface{}{"type": "status", "status": "DISCONNECTED"}
			if ok {
				payload["status"] = tc.Status
				payload["qrCode"] = tc.QRCode
				payload["jid"] = tc.Jid
			}
			data, _ := json.Marshal(payload)
			if err := conn.Write(ctx, websocket.MessageText, data); err != nil {
				return
			}
		}
	}
}

// ─── Core: Create whatsmeow Client ───────────────────────────────────

func (b *Bridge) createClient(tenantID, phone string) (*TenantClient, error) {
	tc := &TenantClient{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Phone:    phone,
		Status:   "CONNECTING",
		QRChan:   make(chan string, 10),
	}

	sessionPath := filepath.Join(b.sessions, tenantID)
	os.MkdirAll(sessionPath, 0700)

	container, err := sqlstore.New("sqlite3", filepath.Join(sessionPath, "whatsapp.db"), nil)
	if err != nil {
		return nil, fmt.Errorf("session store: %w", err)
	}

	device, err := container.GetFirstDevice()
	if err != nil {
		return nil, fmt.Errorf("get device: %w", err)
	}

	client := whatsmeow.NewClient(device, nil)
	tc.Client = client

	client.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.QR:
			qrStr := v.Codes[0]
			tc.mu.Lock()
			tc.QRCode = qrStr
			tc.Status = "QR_READY"
			tc.mu.Unlock()
			b.db.Exec(`UPDATE Tenant SET whatsappStatus='QR_READY' WHERE id=?`, tenantID)
			log.Printf("[%s] QR generated (%d chars)", tenantID, len(qrStr))

		case *events.Connected:
			jid := client.Store.ID.String()
			tc.mu.Lock()
			tc.Jid = jid
			tc.Status = "CONNECTED"
			tc.QRCode = ""
			tc.ConnectedAt = time.Now().Format(time.RFC3339)
			tc.mu.Unlock()
			now := time.Now().Format("2006-01-02T15:04:05Z")
			b.db.Exec(`UPDATE Tenant SET whatsappStatus='CONNECTED', whatsappJid=?, whatsappConnectedAt=? WHERE id=?`,
				jid, now, tenantID)
			log.Printf("[%s] CONNECTED as %s", tenantID, jid)

		case *events.Disconnected:
			tc.mu.Lock()
			tc.Status = "DISCONNECTED"
			tc.mu.Unlock()
			b.db.Exec(`UPDATE Tenant SET whatsappStatus='DISCONNECTED' WHERE id=?`, tenantID)
			log.Printf("[%s] Disconnected", tenantID)

		case *events.Message:
			if v.Info.IsFromMe {
				return
			}
			sender := v.Info.Sender.String()
			msgText := ""
			if v.Message.GetConversation() != "" {
				msgText = v.Message.GetConversation()
			} else if v.Message.GetExtendedText() != nil {
				msgText = v.Message.GetExtendedText().GetText()
			}
			if msgText != "" {
				log.Printf("[%s] ← %s: %s", tenantID, sender, trunc(msgText, 80))
				b.handleIncomingMessage(tenantID, sender, msgText)
			}

		case *events.Receipt:
			now := time.Now().Format("2006-01-02T15:04:05Z")
			for _, id := range v.MessageIDs {
				msgIDStr := id.String()
				if v.Type == types.ReceiptTypeDelivered {
					b.db.Exec(`UPDATE AgentMessage SET status='DELIVERED', deliveredAt=? WHERE whatsappMessageId=?`, now, msgIDStr)
				} else if v.Type == types.ReceiptTypeRead {
					b.db.Exec(`UPDATE AgentMessage SET status='READ', readAt=? WHERE whatsappMessageId=?`, now, msgIDStr)
				}
			}
		}
	})

	if err := client.Connect(); err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	b.mu.Lock()
	b.clients[tenantID] = tc
	b.mu.Unlock()

	return tc, nil
}

// ─── Incoming Message Handler ────────────────────────────────────────

func (b *Bridge) handleIncomingMessage(tenantID, senderJid, text string) {
	var agentID, agentName string
	var agentPhone sql.NullString

	// Match by whatsappJid
	err := b.db.QueryRow(
		`SELECT id, name, phone FROM User WHERE tenantId=? AND whatsappJid=? AND role='FIELD_AGENT'`,
		tenantID, senderJid,
	).Scan(&agentID, &agentName, &agentPhone)

	if err != nil {
		// Fallback: match by phone digits
		phoneDigits := strings.Split(senderJid, "@")[0]
		err = b.db.QueryRow(
			`SELECT id, name, phone FROM User WHERE tenantId=? AND (phone LIKE ? OR phone LIKE ?) AND role='FIELD_AGENT' LIMIT 1`,
			tenantID, "%"+phoneDigits, "%"+phoneDigits[3:],
		).Scan(&agentID, &agentName, &agentPhone)
		if err != nil {
			log.Printf("[%s] No agent found for %s", tenantID, senderJid)
			return
		}
	}

	// Update JID mapping
	b.db.Exec(`UPDATE User SET whatsappJid=? WHERE id=? AND (whatsappJid IS NULL OR whatsappJid='')`, senderJid, agentID)

	// Record reply on most recent message
	now := time.Now().Format("2006-01-02T15:04:05Z")
	b.db.Exec(`
		UPDATE AgentMessage SET responseText=?, respondedAt=?, status='READ'
		WHERE id = (SELECT id FROM AgentMessage WHERE tenantId=? AND agentId=? AND responseText IS NULL ORDER BY createdAt DESC LIMIT 1)
	`, text, now, tenantID, agentID)

	// Mark agent online
	b.db.Exec(`UPDATE User SET isOnline=1, lastSeenAt=? WHERE id=?`, now, agentID)
}

// ─── Restore ─────────────────────────────────────────────────────────

func (b *Bridge) restoreConnections() {
	rows, err := b.db.Query(
		`SELECT id, whatsappPhone FROM Tenant WHERE whatsappPhone IS NOT NULL AND whatsappPhone != '' AND isActive=1`,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, phone string
		rows.Scan(&id, &phone)
		if _, err := b.createClient(id, phone); err != nil {
			log.Printf("Restore failed for %s: %v", id, err)
			b.db.Exec(`UPDATE Tenant SET whatsappStatus='FAILED' WHERE id=?`, id)
			continue
		}
		count++
	}
	if count > 0 {
		log.Printf("Restored %d WhatsApp connection(s)", count)
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────

func parsePhoneToJID(phone string) (types.JID, error) {
	re := regexp.MustCompile(`[^\d]`)
	digits := re.ReplaceAllString(phone, "")
	if len(digits) > 10 && digits[0] == '0' {
		digits = digits[1:]
	}
	if !strings.HasPrefix(digits, "234") && len(digits) == 10 {
		digits = "234" + digits
	}
	if len(digits) < 12 {
		return types.JID{}, fmt.Errorf("phone too short: %s", phone)
	}
	return types.NewJID(digits, "s.whatsapp.net"), nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}