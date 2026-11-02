import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const upload = multer(uploadConfig);
const contactRoutes = express.Router();

contactRoutes.post(
  "/contacts/import",
  isAuth,
  ImportPhoneContactsController.store
);

contactRoutes.post(
  "/contacts/import/csv",
  isAuth,
  upload.single("file"),
  ContactController.importCsv
);

contactRoutes.post(
  "/contacts/import/groups",
  isAuth,
  ContactController.importGroups
);

contactRoutes.get("/contacts/list", isAuth, ContactController.list);

contactRoutes.get("/contacts", isAuth, ContactController.index);

contactRoutes.get("/contacts/:contactId", isAuth, ContactController.show);

contactRoutes.post("/contacts", isAuth, ContactController.store);

contactRoutes.post("/contact", isAuth, ContactController.getContact);

contactRoutes.put("/contacts/:contactId", isAuth, ContactController.update);

contactRoutes.delete("/contacts/:contactId", isAuth, ContactController.remove);

export default contactRoutes;
