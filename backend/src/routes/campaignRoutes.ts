import express from "express";
import multer from "multer";
import uploadConfig from "../config/upload";
import isAuth from "../middleware/isAuth";
import * as CampaignController from "../controllers/CampaignController";

const upload = multer(uploadConfig);
const campaignRoutes = express.Router();

campaignRoutes.get("/campaigns", isAuth, CampaignController.index);
campaignRoutes.post("/campaigns", isAuth, upload.single("media"), CampaignController.store);
campaignRoutes.get("/campaigns/:id", isAuth, CampaignController.show);
campaignRoutes.delete("/campaigns/:id", isAuth, CampaignController.remove);
campaignRoutes.post("/campaigns/:id/start", isAuth, CampaignController.start);
campaignRoutes.post("/campaigns/:id/pause", isAuth, CampaignController.pause);
campaignRoutes.post("/campaigns/:id/cancel", isAuth, CampaignController.cancel);

export default campaignRoutes;
