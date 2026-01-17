# Converge

A full-stack boilerplate with **React**, **Express.js**, and **MongoDB**.

## 📁 Project Structure

```
converge/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Custom middleware
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API routes
│   │   └── index.js        # Server entry point
│   ├── env.example         # Environment template
│   └── package.json
├── frontend/               # React + Vite app
│   ├── src/
│   │   ├── services/       # API service layer
│   │   ├── App.jsx         # Main component
│   │   └── main.jsx        # Entry point
│   └── package.json
├── package.json            # Root scripts
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ 
- **MongoDB** (local installation or MongoDB Atlas)

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Configure Environment

Create a `.env` file in the `backend/` folder:

```bash
cd backend
cp env.example .env
```

Edit `.env` with your settings:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB - Replace with your connection string
MONGODB_URI=mongodb://localhost:27017/converge

# Frontend URL for CORS
CLIENT_URL=http://localhost:5173

# JWT Secret - Generate a secure random string
JWT_SECRET=your_jwt_secret_key_here
```

### 3. Start Development Servers

Run both frontend and backend:

```bash
npm run dev
```

Or run separately:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### 4. Access the App

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/health

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | API info |
| GET | `/api/users` | Get all users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create new user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/health` | Health check |

## 🔧 Configuration

### MongoDB Atlas Setup

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a database user
3. Whitelist your IP address
4. Get your connection string
5. Replace `MONGODB_URI` in `.env`

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/converge?retryWrites=true&w=majority
```

### Production Build

```bash
# Build frontend
npm run build:frontend

# Start backend in production
NODE_ENV=production npm run start:backend
```

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Vite
- CSS3

**Backend:**
- Express.js
- MongoDB + Mongoose
- CORS

## 📝 License

MIT

