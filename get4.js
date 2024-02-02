const { Client } = require("pg");
const platformClient = require("purecloud-platform-client-v2");
const config = require("./config.js");

async function getToken() {
  const client = platformClient.ApiClient.instance;
  client.setEnvironment(platformClient.PureCloudRegionHosts.ap_south_1);

  try {
    const clientInstance = await client.loginClientCredentialsGrant(
      config.clientId,
      config.clientSecret
    );
    const GenesysAccessToken = clientInstance.accessToken;
    client.setAccessToken(GenesysAccessToken);
    console.log("GenesysAccessToken =>", GenesysAccessToken);
    await processConversationDetails(client);
  } catch (err) {
    console.error("Error generating token:", err);
  }
}

async function processConversationDetails(apiClient) {
  let apiInstance = new platformClient.ConversationsApi();
  let body = {
    orderBy: "conversationStart",
    interval: "2024-01-01T18:30:00Z/2024-01-03T18:30:00Z",
    order: "desc",
  };

  try {
    const conversationDetails =
      await apiInstance.postAnalyticsConversationsDetailsQuery(body);
    // console.log("ConversationDetails:", conversationDetails);

    if (
      conversationDetails &&
      conversationDetails.conversations &&
      conversationDetails.conversations.length > 0
    ) {
      const dbClient = new Client(config.database);

      await dbClient.connect();

      // Create table if not exists
      await dbClient.query(`
      CREATE TABLE IF NOT EXISTS conversation_details (
        conversation_id TEXT PRIMARY KEY,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        originating_direction VARCHAR(255)
      )`);

      try {
        for (let i = 0; i < conversationDetails.conversations.length; i++) {
          let conversation = conversationDetails.conversations[i];
          let conversationStart = conversation.conversationStart;
          console.log("conversationStart =>", conversationStart);
          let conversationId1 = conversation.conversationId;
          console.log("conversationId1 =>", conversationId1);
          let conversationEnd = conversation.conversationEnd;
          console.log("conversationEnd =>", conversationEnd);
          let originatingDirection = conversation.originatingDirection;
          console.log("originatingDirection =>", originatingDirection);

          // Upsert query
          let upsertQuery = `
            WITH upsert AS (
              UPDATE "conversation_details"
              SET "start_date" = '${conversationStart}',
                  "end_date" = '${conversationEnd}',
                  "originating_direction" = '${originatingDirection}'
              WHERE "conversation_id" = '${conversationId1}'
              RETURNING *
            )
            INSERT INTO "conversation_details" ("conversation_id", "start_date", "end_date", "originating_direction")
            SELECT '${conversationId1}', '${conversationStart}', '${conversationEnd}', '${originatingDirection}'
            WHERE NOT EXISTS (SELECT * FROM upsert)`;

          try {
            const result = await dbClient.query(upsertQuery);
            // console.log("Upsert result:", result);
          } catch (err) {
            console.error("Error executing upsert query:", err);
          }

          console.log("\n *** Conversation data processed ***\n");
        }
      } catch (err) {
        console.error("Error fetching or storing conversation details:", err);
      } finally {
        await dbClient.end();
      }
    } else {
      console.error("Invalid conversationDetails structure or missing data.");
    }
  } catch (err) {
    console.error("Error calling postAnalyticsConversationsDetailsQuery:", err);
  }
}

getToken();
