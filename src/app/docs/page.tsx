'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
  return (
    <div style={{ height: '100vh' }}>
      <SwaggerUI
        url="/api/docs"
        requestInterceptor={(req) => {
          // Include credentials for try-it-out to work
          return req;
        }}
      />
    </div>
  );
}
