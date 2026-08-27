# 🚀 Crawlee Scraper Service (Google Maps & Instagram)

Microserviço *open-source* de extração de leads e contatos construído com **Node.js, Crawlee e Playwright** para substituir a dependência de APIs pagas (como Apify), sem limite de créditos mensais.

---

## 📌 Funcionalidades

- **Google Maps Scraper:** Extração de Nome da Empresa, Telefone, Endereço, Categoria, Website.
- **Deep Contact Extraction:** Varredura automática no website e páginas `/contato`, `/fale-conosco` para captura de **E-mails comerciais** e **WhatsApp**.
- **Instagram Scraper:** Extração de perfis, biografia, seguidores, WhatsApp e e-mail.
- **Formato Pronto para n8n / Google Sheets:** Retorno em JSON 100% alinhado às colunas das planilhas.

---

## 🛠️ Como Executar Localmente

```bash
# 1. Instalar dependências e navegadores
npm install
npx playwright install chromium

# 2. Iniciar o servidor
npm start
# O serviço iniciará em http://localhost:3001
```

---

## 🐳 Como Rodar em Produção com Docker

```bash
# 1. Construir a imagem Docker
docker build -t crawlee-scraper .

# 2. Rodar o container
docker run -d --name crawlee-scraper -p 3001:3001 --restart always crawlee-scraper
```

---

## ⚡ Como Rodar em Produção com PM2 (VPS)

```bash
# 1. Instalar dependências
npm install --production
npx playwright install --with-deps chromium

# 2. Iniciar via PM2
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 📡 Endpoints da API

### 1. `POST /api/scrape/maps`
Extrai empresas do Google Maps e vasculha seus websites em busca de e-mails.

**Exemplo de Payload:**
```json
{
  "query": "construtora em Porto Alegre RS",
  "maxResults": 30,
  "scrapeContacts": true
}
```

### 2. `POST /api/scrape/instagram`
Extrai perfis comerciais do Instagram com WhatsApp e E-mail.

**Exemplo de Payload:**
```json
{
  "query": "advocacia Porto Alegre",
  "maxResults": 30
}
```

### 3. `GET /health`
Verifica se o microserviço está operante.
