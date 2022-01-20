import express from 'express';
import { ActionPlanRoutes } from "./action-plans/actionPlan.routes";

export function initRoutes(app:express.Application) {
    // Mount the ActionPlansController at the /action-plan route
    app.use('/action-plan', ActionPlanRoutes);
}