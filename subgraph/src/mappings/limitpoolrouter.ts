import { RouterDeployed } from "../../generated/PoolsharkRouter/PoolsharkRouter";
import { safeLoadPoolRouter } from "./utils/loads";

export function handleRouterDeploy(event: RouterDeployed): void {
    let routerParam = event.params.router
    let limitPoolFactoryParam = event.params.limitPoolFactory
    let coverPoolFactoryParam = event.params.coverPoolFactory

    let loadPoolRouter = safeLoadPoolRouter(routerParam.toHex())

    let poolRouter = loadPoolRouter.entity

    if (!loadPoolRouter.exists) {
        poolRouter.limitPoolFactory = limitPoolFactoryParam
        poolRouter.coverPoolFactory = coverPoolFactoryParam
    }
    poolRouter.save()
}