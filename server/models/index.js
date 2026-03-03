import { Elysia } from 'elysia';
import { commonModels }     from './common.model.js';
import { dashboardModels }  from './dashboard.model.js';
import { queryModels }      from './query.model.js';
import { dataSourceModels } from './data-source.model.js';
import { metricsModels }    from './metrics.model.js';
import { templateModels }   from './template.model.js';
import { themeModels }      from './theme.model.js';

export const models = new Elysia({ name: 'models' })
  .use(commonModels)
  .use(dashboardModels)
  .use(queryModels)
  .use(dataSourceModels)
  .use(metricsModels)
  .use(templateModels)
  .use(themeModels);
