/* ------------------------------------------------ */
/* SWAGGER / OPENAPI CONFIG                         */
/* ------------------------------------------------ */

import swaggerJSDoc from "swagger-jsdoc";

/* ------------------------------------------------ */
/* OPTIONS                                          */
/* ------------------------------------------------ */

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "ODIN API",
      version: "1.0.0",
      description: "Backend API Documentation",
    },

    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5055}`,
        description: "Local development server",
      },
    ],
  },

  /* ------------------------------------------------ */
  /* ROUTE FILES                                     */
  /* ------------------------------------------------ */
  // WICHTIG: **/* damit auch routes/auth/*.js erkannt werden
  apis: ["./routes/**/*.js"],
};

/* ------------------------------------------------ */
/* EXPORT                                           */
/* ------------------------------------------------ */

export const swaggerSpec = swaggerJSDoc(options);
