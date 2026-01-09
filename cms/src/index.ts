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
      // Find the Public role
      const publicRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "public" } });

      if (publicRole) {
        // List of actions to enable
        const actions = [
          "api::policy.policy.find",
          "api::policy.policy.findOne",
          "api::policy.policy.create",
          "api::policy.policy.update",
          "api::policy.policy.delete",
        ];

        // Create permissions if they don't exist
        await Promise.all(
          actions.map(async (action) => {
            const permissionExists = await strapi
              .query("plugin::users-permissions.permission")
              .findOne({
                where: {
                  role: publicRole.id,
                  action: action,
                },
              });

            if (!permissionExists) {
              await strapi.query("plugin::users-permissions.permission").create({
                data: {
                  action: action,
                  role: publicRole.id,
                },
              });
              console.log(`Enabled public permission for ${action}`);
            }
          })
        );
      }

      // Seed Webhook for MCP Service
      const webhookStore = (strapi as any).webhookStore;
      const webhooks = await webhookStore.findWebhooks();
      const mcpWebhookUrl = "http://host.docker.internal:3001/webhooks/policy-update";

      const exists = webhooks.find(w => w.url === mcpWebhookUrl);

      if (!exists) {
        await webhookStore.createWebhook({
          name: "MCP Policy Sync",
          url: mcpWebhookUrl,
          events: ["entry.create", "entry.update", "entry.publish"],
          isEnabled: true,
        });
        console.log("Created MCP Policy Sync Webhook");
      }

    } catch (error) {
      console.error("Bootstrap permission error:", error);
    }
  },
};
