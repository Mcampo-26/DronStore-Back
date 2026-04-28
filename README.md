
🛸 Eje Backend: DRONSTORE Core API

Descripción: Implementar la infraestructura de servidor escalable para gestionar la flota de drones, el sistema de auditoría y la lógica de negocio del e-commerce.
⚙️ Arquitectura & Endpoints

    🛡️ Auth & Gatekeeper: Rutas /auth/login y /auth/profile protegidas por JWT. Implementación de control de acceso basado en roles (RBAC) para el Dashboard.

    📦 Product Engine: Sistema CRUD completo en /api/products optimizado para el catálogo dinámico.

    📋 Audit Log System: Middleware automático que registra cada acción de usuario en la base de datos (Auditoría de Logs).

    👤 User Management: Endpoints para gestión de perfiles, roles y permisos en /api/users.

    🛒 Order Processor: Gestión de transacciones y persistencia de carritos de compra.

📋 Checklist de Desarrollo

    🚀 System Init: Configuración de Express con soporte nativo para Node.js 20+ y variables de entorno.

    🧱 Database Schema: Modelado de datos en MongoDB/Mongoose (Productos, Usuarios, Logs de Auditoría).

    🚦 Route Mapping: Solución definitiva al error 404 mediante el registro correcto de prefijos en app.use().

    🔐 Security Layers: Implementación de helmet, cors (configurado para el dominio del Front) y limitación de tasa (rate limiting).

    📤 Cloud Integration: Conexión con servicios de almacenamiento para imágenes de drones y despliegue continuo en Heroku.

🛠️ Stack Tecnológico (Backend)
Herramienta	Uso
Node.js & Express	Entorno de ejecución y framework de rutas.
MongoDB & Mongoose	Base de datos NoSQL y modelado de objetos.
JWT (jsonwebtoken)	Token de seguridad para sesiones persistentes.
Morgan & Winston	Sistema de logs y auditoría técnica.
Bcrypt.js	Encriptación de alta seguridad para credenciales.
