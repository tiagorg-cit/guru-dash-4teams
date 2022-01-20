import express from 'express';
import morgan from "morgan";
import * as bodyParser from "body-parser";
import { initRoutes } from "./controllers/routes";
import swaggerUi from "swagger-ui-express";

export function initServer() {
    // Create a new express application instance
    const app: express.Application = express();

    // support application/json type post data
    app.use(bodyParser.json());
    //support application/x-www-form-urlencoded post data
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(morgan("tiny"));
    app.use(express.static("public"));

    //init swagger
    app.use(
        "/docs",
        swaggerUi.serve,
        swaggerUi.setup(undefined, {
            swaggerOptions: {
            url: "/swagger.json",
            },
        })
    );

    // initialize controllers
    initRoutes(app);

    // The port the express app will listen on
    const port = process.env.PORT || 3000;

    // Serve the application at the given port
    app.listen(port, () => {
        // Success callback
        console.log(`Listening at http://localhost:${port}/`);
    }); 
}
