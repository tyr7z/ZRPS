// Import core dependencies
import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import cookieParser from "cookie-parser";
import path, { dirname } from "path";
import * as dotenv from "dotenv";
import * as url from "url";
import fs from "fs";

// Load environment config
dotenv.config();

// Create web server
const app = express();
app.set("trust proxy", true);

// Create MySQL pool connection
const mysqlOptions = {
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: parseInt(process.env.DATABASE_PORT || "3306"),
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
};
if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase() === "true") {
    mysqlOptions.ssl = {
        rejectUnauthorized: true,
    };
}
const pool = mysql.createPool(mysqlOptions);
app.mysql = {
    async getConnection() {
        return pool.getConnection();
    },
};

// Register middleware and view engine
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || "my-secret"));

const __dirname = dirname(url.fileURLToPath(import.meta.url));
app.set("views", __dirname);
app.set("view engine", "pug");

app.use((req, res, next) => {
    req.unsignCookie = (value) => {
        const unsigned = cookieParser.signedCookie(
            value,
            process.env.COOKIE_SECRET || "my-secret"
        );
        return {
            valid: unsigned !== false,
            value: unsigned !== false ? unsigned : null,
        };
    };

    res.view = (viewPath, locals) => res.render(viewPath, locals);
    res.code = (statusCode) => res.status(statusCode);

    const originalCookie = res.cookie.bind(res);
    res.cookie = (name, value, options = {}) => {
        const normalizedOptions = { ...options };

        if (
            typeof normalizedOptions.maxAge === "number" &&
            normalizedOptions.maxAge > 0 &&
            normalizedOptions.maxAge < 1000 * 60 * 60 * 24 * 365
        ) {
            normalizedOptions.maxAge *= 1000;
        }

        if (typeof normalizedOptions.expires === "number") {
            normalizedOptions.expires = new Date(normalizedOptions.expires);
        }

        if (normalizedOptions.secure === "auto") {
            normalizedOptions.secure =
                req.secure ||
                req.headers["x-forwarded-proto"] === "https";
        }

        return originalCookie(name, value, normalizedOptions);
    };

    next();
});

function createCompatibleRouter(server, prefix = "") {
    const normalizePath = (routePath) => {
        if (!routePath || routePath === "/") {
            return prefix || "/";
        }

        const joined = `${prefix}${routePath}`.replace(/\/+/g, "/");
        return joined.startsWith("/") ? joined : `/${joined}`;
    };

    const registerRoute = (method, routePath, handler) => {
        server[method](normalizePath(routePath), async (req, res, next) => {
            try {
                const result = await handler(req, res, next);
                if (!res.headersSent && result !== undefined) {
                    res.send(result);
                }
            } catch (error) {
                next(error);
            }
        });
    };

    return {
        mysql: app.mysql,
        get(routePath, handler) {
            registerRoute("get", routePath, handler);
        },
        post(routePath, handler) {
            registerRoute("post", routePath, handler);
        },
    };
}

// Register routes
const routesPath = path.join(__dirname, "routes");
for (const file of fs.readdirSync(routesPath).filter((f) => f.endsWith(".js"))) {
    const route = await import(new URL(file, url.pathToFileURL(routesPath + path.sep)));
    const prefix = "prefix" in route ? route.prefix : "";
    const router = createCompatibleRouter(app, prefix);
    await route.default(router);
}

// Serve static content
app.use(express.static(path.join(__dirname, "public")));

app.use((err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) {
        return;
    }

    res.status(500).send({
        status: "error",
        message: "Internal server error",
    });
});

// Start web server
const port = parseInt(process.env.PORT || "3001");
const host = process.env.HOST || "localhost";

app.listen(port, host, () => {
    console.log(
        `[${process.env.SERVER_NAME || "ZRPS"}] API is now listening on http://${host}:${port}`
    );
});
