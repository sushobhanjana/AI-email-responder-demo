import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) { },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      // 1. Get the Public Role
      const publicRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "public" } });

      if (publicRole) {
        // 2. Define permissions to add
        const permissionsToAdd = [
          "api::policy.policy.find",
          "api::policy.policy.findOne",
          "api::policy.policy.create",
          "api::policy.policy.update",
        ];

        // 3. Get existing permissions for this role
        const existingPermissions = await strapi
          .query("plugin::users-permissions.permission")
          .findMany({
            where: {
              role: publicRole.id,
              action: { $in: permissionsToAdd },
            },
          });

        const existingActions = existingPermissions.map((p) => p.action);

        // 4. Create missing permissions
        for (const action of permissionsToAdd) {
          if (!existingActions.includes(action)) {
            await strapi.query("plugin::users-permissions.permission").create({
              data: {
                action,
                role: publicRole.id,
              },
            });
            strapi.log.info(`[Bootstrap] Granted public permission: ${action}`);
          }
        }
      }
    } catch (error) {
      strapi.log.error("[Bootstrap] Failed to set permissions: " + error);
    }
  },
};

