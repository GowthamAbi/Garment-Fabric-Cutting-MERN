# Accessories Flow MVC Folder Structure

```text
Store/
│
├── README.md
├── FOLDER_STRUCTURE.md
├── package.json
├── .gitignore
│
├── client/                         React View layer
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   │
│   └── src/
│       ├── main.jsx                React entry point
│       ├── App.jsx                 Provider and application wrapper only
│       ├── api.js                  Backend request helper
│       ├── styles.css              Responsive UI styles
│       │
│       ├── components/
│       │   ├── DataTable.jsx
│       │   ├── Modal.jsx
│       │   ├── common/
│       │   │   ├── Card.jsx
│       │   │   ├── EmptyState.jsx
│       │   │   ├── Field.jsx
│       │   │   ├── FormActions.jsx
│       │   │   └── PageTitle.jsx
│       │   └── layout/
│       │       └── MainLayout.jsx
│       │
│       ├── context/
│       │   └── AuthContext.jsx
│       │
│       ├── pages/
│       │   ├── auth/LoginPage.jsx
│       │   ├── dashboard/DashboardPage.jsx
│       │   ├── history/HistoryPage.jsx
│       │   ├── inward/InwardPage.jsx
│       │   ├── master/ItemMasterPage.jsx
│       │   ├── outward/OutwardPage.jsx
│       │   ├── purchase-order/PurchaseOrderPage.jsx
│       │   └── stock/StockPage.jsx
│       │
│       ├── routes/
│       │   └── AppRoutes.jsx
│       ├── services/
│       │   └── tokenService.js
│       └── utils/
│           └── formatters.js
│
└── server/                         Node + Express MVC backend
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    │
    └── src/
        ├── server.js               Starts the server
        ├── app.js                  Express middleware and routes
        │
        ├── config/
        │   ├── database.js         MongoDB connection
        │   └── environment.js      Environment validation
        │
        ├── models/                 MODEL layer
        │   ├── User.js
        │   ├── Item.js
        │   ├── PurchaseOrder.js
        │   └── Transaction.js
        │
        ├── controllers/            CONTROLLER layer
        │   ├── authController.js
        │   ├── dashboardController.js
        │   ├── itemController.js
        │   ├── purchaseOrderController.js
        │   └── transactionController.js
        │
        ├── services/               Business-logic layer
        │   ├── itemService.js
        │   ├── dashboardService.js
        │   ├── purchaseOrderService.js
        │   └── stockService.js
        │
        ├── repositories/           MongoDB query layer
        │   ├── itemRepository.js
        │   ├── purchaseOrderRepository.js
        │   └── transactionRepository.js
        │
        ├── routes/                 API URL definitions
        │   ├── index.js
        │   ├── auth.routes.js
        │   ├── dashboard.routes.js
        │   ├── items.routes.js
        │   ├── po.routes.js
        │   └── transactions.routes.js
        │
        ├── middleware/
        │   ├── authMiddleware.js
        │   └── errorHandler.js
        │
        ├── validators/
        │   └── itemValidator.js
        │
        ├── constants/
        │   ├── orderStatus.js
        │   └── transactionTypes.js
        │
        └── utils/
            ├── ApiError.js
            ├── asyncHandler.js
            └── generateReferenceNo.js
```

## Added Elastic Production MVC modules

```text
client/src/pages/production/
├── ProductionDashboardPage.jsx
├── ProductionControlPage.jsx
├── ProductionSetupPage.jsx
├── PendingPage.jsx
└── SewingDeliveryPage.jsx

server/src/
├── models/{Machine,Employee,ProductionJob,PendingIssue,SewingDelivery}.js
├── controllers/productionController.js
└── routes/production.routes.js
```

## Request flow

```text
React page
    ↓
API helper
    ↓
Express route
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
Mongoose model
    ↓
MongoDB Atlas
```

The controller never contains MongoDB queries. The service owns stock and
purchase-order calculations. The repository is the only layer that directly
queries the database.
