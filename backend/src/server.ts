import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  logger.info(`Server started on port: ${port}`);
});

initIO(server);
StartAllWhatsAppsSessions();
gracefulShutdown(server);

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});
