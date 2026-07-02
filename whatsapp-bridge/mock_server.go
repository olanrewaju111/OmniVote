// Mock WhatsApp Bridge Server — simulates the Go whatsmeow service
// This runs when Go < 1.25 is detected, providing the same API surface.
// In production, replace with the real whatsmeow-based bridge.
package main

import (
        "database/sql"
        "encoding/json"
        "fmt"
        "io"
        "log"
        "net/http"
        "os"
        "os/signal"
        "path/filepath"
        "strings"
        "sync"
        "syscall"
        "time"

        "context"

        "github.com/go-chi/chi/v5"
        "github.com/go-chi/cors"
        "github.com/google/uuid"
        _ "github.com/mattn/go-sqlite3"
        "nhooyr.io/websocket"
)

type Bridge struct {
        db      *sql.DB
        clients map[string]*MockClient
        mu      sync.RWMutex
}

type MockClient struct {
        TenantID     string `json:"tenantId"`
        Phone        string `json:"phone"`
        Jid          string `json:"jid,omitempty"`
        Status       string `json:"status"`
        QRCode       string `json:"qrCode,omitempty"`
        ConnectedAt  string `json:"connectedAt,omitempty"`
        MessageCount int    `json:"messageCount"`
}

type SendRequest struct {
        TenantID  string `json:"tenantId"`
        MessageID string `json:"messageId"`
        ToPhone   string `json:"toPhone"`
        Subject   string `json:"subject"`
        Body      string `json:"body"`
        Priority  string `json:"priority"`
}

func main() {
        dbPath := os.Getenv("DB_PATH")
        if dbPath == "" {
                dbPath = filepath.Join("..", "db", "custom.db")
        }

        db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
        if err != nil {
                log.Fatalf("DB error: %v", err)
        }
        defer db.Close()

        bridge := &Bridge{db: db, clients: make(map[string]*MockClient)}

        r := chi.NewRouter()
        r.Use(cors.Handler(cors.Options{
                AllowedOrigins:   []string{"*"},
                AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
                AllowedHeaders:   []string{"Content-Type", "Authorization"},
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

        port := os.Getenv("PORT")
        if port == "" {
                port = "9090"
        }

        server := &http.Server{Addr: ":" + port, Handler: r}

        go func() {
                log.Printf("🔒 MOCK WhatsApp Bridge on :%s (replace with real whatsmeow bridge for production)", port)
                log.Printf("   DB: %s", dbPath)
                if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                        log.Fatalf("Server error: %v", err)
                }
        }()

        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        <-quit
        log.Println("Mock bridge stopped")
 srvCtx, srvCancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer srvCancel()
        server.Shutdown(srvCtx)
}

func (b *Bridge) handleLink(w http.ResponseWriter, r *http.Request) {
        var req struct {
                TenantID string `json:"tenantId"`
                Phone     string `json:"phone"`
        }
        json.NewDecoder(r.Body).Decode(&req)

        if req.TenantID == "" || req.Phone == "" {
                writeJSON(w, 400, map[string]string{"error": "tenantId and phone required"})
                return
        }

        // Generate a mock QR code (in production, whatsmeow generates this)
        qrID := uuid.New().String()
        mockQR := fmt.Sprintf("MOCK_QR_%s_%d", qrID[:8], time.Now().Unix())

        // Create JID from phone
        digits := strings.Map(func(r rune) rune {
                if r >= '0' && r <= '9' { return r }
                return -1
        }, req.Phone)
        if strings.HasPrefix(digits, "0") { digits = "234" + digits[1:] }
        jid := digits + "@s.whatsapp.net"

        mc := &MockClient{
                TenantID:    req.TenantID,
                Phone:       req.Phone,
                Jid:         jid,
                Status:      "QR_READY",
                QRCode:      mockQR,
                ConnectedAt: time.Now().Format(time.RFC3339),
        }

        b.mu.Lock()
        b.clients[req.TenantID] = mc
        b.mu.Unlock()

        // Simulate auto-connect after 3 seconds (in production, user scans QR)
        go func() {
                time.Sleep(3 * time.Second)
                b.mu.Lock()
                if c, ok := b.clients[req.TenantID]; ok && c.Status == "QR_READY" {
                        c.Status = "CONNECTED"
                        c.QRCode = ""
                        c.ConnectedAt = time.Now().Format(time.RFC3339)
                }
                b.mu.Unlock()
                now := time.Now().Format("2006-01-02T15:04:05Z")
                b.db.Exec(`UPDATE Tenant SET whatsappStatus='CONNECTED', whatsappJid=?, whatsappConnectedAt=?, whatsappPhone=? WHERE id=?`,
                        jid, now, req.Phone, req.TenantID)
                log.Printf("[MOCK] %s auto-connected as %s", req.TenantID, jid)
        }()

        b.db.Exec(`UPDATE Tenant SET whatsappStatus='QR_READY', whatsappPhone=? WHERE id=?`, req.Phone, req.TenantID)

        writeJSON(w, 200, mc)
}

func (b *Bridge) handleGetQR(w http.ResponseWriter, r *http.Request) {
        tenantID := chi.URLParam(r, "tenantId")
        b.mu.RLock()
        tc, ok := b.clients[tenantID]
        b.mu.RUnlock()
        if !ok {
                writeJSON(w, 404, map[string]string{"tenantId": tenantID, "status": "DISCONNECTED"})
                return
        }
        writeJSON(w, 200, tc)
}

func (b *Bridge) handleStatus(w http.ResponseWriter, r *http.Request) {
        tenantID := chi.URLParam(r, "tenantID")
        b.mu.RLock()
        tc, ok := b.clients[tenantID]
        b.mu.RUnlock()
        if !ok {
                writeJSON(w, 200, map[string]string{"tenantId": tenantID, "status": "DISCONNECTED"})
                return
        }
        writeJSON(w, 200, tc)
}

func (b *Bridge) handleSend(w http.ResponseWriter, r *http.Request) {
        var req SendRequest
        json.NewDecoder(r.Body).Decode(&req)

        if req.TenantID == "" || req.ToPhone == "" || req.Body == "" {
                writeJSON(w, 400, map[string]string{"error": "tenantId, toPhone, and body required"})
                return
        }

        b.mu.RLock()
        tc, ok := b.clients[req.TenantID]
        b.mu.RUnlock()

        if !ok || tc.Status != "CONNECTED" {
                writeJSON(w, 503, map[string]string{"error": "WhatsApp not connected", "status": "DISCONNECTED"})
                return
        }

        msgID := uuid.New().String()
        ts := time.Now()

        // Simulate delivery
        time.Sleep(200 * time.Millisecond)

        // Update message in DB
        if req.MessageID != "" {
                b.db.Exec(`UPDATE AgentMessage SET status='SENT', whatsappMessageId=? WHERE id=?`, msgID, req.MessageID)
                // Simulate delivery after 2s
                go func() {
                        time.Sleep(2 * time.Second)
                        b.db.Exec(`UPDATE AgentMessage SET status='DELIVERED', deliveredAt=? WHERE whatsappMessageId=?`,
                                time.Now().Format("2006-01-02T15:04:05Z"), msgID)
                        // Simulate read after 5s (50% chance)
                        if time.Now().Unix()%2 == 0 {
                                time.Sleep(3 * time.Second)
                                b.db.Exec(`UPDATE AgentMessage SET status='READ', readAt=? WHERE whatsappMessageId=?`,
                                        time.Now().Format("2006-01-02T15:04:05Z"), msgID)
                        }
                }()
        }

        b.mu.Lock()
        tc.MessageCount++
        b.mu.Unlock()

        log.Printf("[MOCK] Sent to %s: [%s] %s", req.ToPhone, req.Subject, trunc(req.Body, 60))

        writeJSON(w, 200, map[string]interface{}{
                "success":        true,
                "whatsappMessageId": msgID,
                "timestamp":      ts.Format(time.RFC3339),
                "channel":        "WHATSAPP",
                "mode":           "MOCK",
        })
}

func (b *Bridge) handleDisconnect(w http.ResponseWriter, r *http.Request) {
        tenantID := chi.URLParam(r, "tenantID")
        b.mu.Lock()
        delete(b.clients, tenantID)
        b.mu.Unlock()
        b.db.Exec(`UPDATE Tenant SET whatsappStatus='DISCONNECTED', whatsappJid=NULL WHERE id=?`, tenantID)
        writeJSON(w, 200, map[string]string{"status": "DISCONNECTED"})
}

func (b *Bridge) handleListTenants(w http.ResponseWriter, r *http.Request) {
        rows, err := b.db.Query(`SELECT id, name, slug, COALESCE(whatsappPhone,''), COALESCE(whatsappJid,''), COALESCE(whatsappStatus,'DISCONNECTED') FROM Tenant WHERE isActive=1`)
        if err != nil {
                writeJSON(w, 500, map[string]string{"error": err.Error()})
                return
        }
        defer rows.Close()

        type T struct{ ID, Name, Slug, Phone, Jid, Status string }
        var tenants []T
        for rows.Next() {
                var t T
                rows.Scan(&t.ID, &t.Name, &t.Slug, &t.Phone, &t.Jid, &t.Status)
                tenants = append(tenants, t)
        }

        b.mu.RLock()
        for i := range tenants {
                if tc, ok := b.clients[tenants[i].ID]; ok {
                        tenants[i].Status = tc.Status
                }
        }
        b.mu.RUnlock()

        if tenants == nil { tenants = []T{} }
        writeJSON(w, 200, tenants)
}

func (b *Bridge) handleStatusWebhook(w http.ResponseWriter, r *http.Request) {
        io.Copy(io.Discard, r.Body)
        w.WriteHeader(200)
}

func (b *Bridge) handleWebSocket(w http.ResponseWriter, r *http.Request) {
        tenantID := strings.TrimSuffix(chi.URLParam(r, "tenantID"), "/")
        conn, err := websocket.Accept(w, r, nil)
        if err != nil { return }
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
                        payload := map[string]interface{}{"type": "status", "status": "DISCONNECTED", "mode": "MOCK"}
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

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(status)
        json.NewEncoder(w).Encode(v)
}

func trunc(s string, n int) string {
        if len(s) <= n { return s }
        return s[:n] + "..."
}