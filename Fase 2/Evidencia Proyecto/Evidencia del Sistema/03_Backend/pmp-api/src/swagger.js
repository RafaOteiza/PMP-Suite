import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PMP Suite API",
      version: "1.0.0",
      description:
        "Autenticacion mediante Firebase Authentication (Authorization: Bearer <Firebase ID Token>). La API valida el token con Firebase Admin SDK y autoriza el acceso usando el rol almacenado en pmp.usuarios. Solo usuarios existentes y activos en PostgreSQL pueden operar; si no existe o esta inactivo devuelve 403."
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Firebase ID Token"
        }
      }
    }
  },
  apis: ["./src/routes/*.js"]
});
