import { Router, Request, Response } from 'express';
import ActionPlanController from "./actionPlan.controller";

const router: Router = Router();

router.post('/:provider/project/:projectKey/reload', async (req: Request, res: Response) => {
    const provider:string = req.params.provider;
    const projectKey:string = req.params.projectKey;
    const actionPlanController = new ActionPlanController();
    const response = await actionPlanController.reloadActionPlansByProject(provider, projectKey);
    return res.status(response.code).send(response);
});

// Export the express.Router() instance
export const ActionPlanRoutes: Router = router;