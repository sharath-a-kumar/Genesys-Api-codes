const platformClient = require("purecloud-platform-client-v2");
const { Client } = require("pg");
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
  } catch (err) {
    console.error("Error generating token:", err);
    return;
  }

  try {
    const dbClient = new Client(config.database);
    await dbClient.connect();

    const ConversationsApi = new platformClient.ConversationsApi();
    const conversationId = "930d9b07-73ed-4695-b705-5877ebc02ae3";

    try {
      const conversationDetails = await ConversationsApi.getAnalyticsConversationDetails(conversationId);
      console.log(
        "\n Conversations Details are Printed here:\n",
        "\n ani=>",
        conversationDetails.participants[0].sessions[0].ani,
        "\n Direction=>",
        conversationDetails.originatingDirection,
        "\n dnis=>",
        conversationDetails.participants[0].sessions[0].dnis,
        "\n division=>",
        conversationDetails.divisionIds,
        "\n conversationStart=>",
        conversationDetails.conversationStart,
        "\n conversationEnd",
        conversationDetails.conversationEnd
      );

      let conversationId1 = conversationDetails.conversationId;
      let conversationStart = conversationDetails.conversationStart;
      let conversationEnd = conversationDetails.conversationEnd;
      let ani = conversationDetails.participants[0].sessions[0].ani;
      let dnis = conversationDetails.participants[0].sessions[0].dnis;
      let direction = conversationDetails.originatingDirection;
      let divisionIds = conversationDetails.divisionIds;

      await dbClient.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          conversationid1 TEXT PRIMARY KEY,
          startdate DATE,
          enddate DATE,
          ani VARCHAR(255),
          dnis VARCHAR(255),
          direction VARCHAR(255),
          divisionid TEXT
        )`);

      let upsertQuery = `
        WITH upsert AS (
          UPDATE "conversations"
          SET "startdate" = '${conversationStart}',
              "enddate" = '${conversationEnd}',
              "ani" = '${ani}',
              "dnis" = '${dnis}',
              "direction" = '${direction}',
              "divisionid" = '${divisionIds}'
          WHERE "conversationid1" = '${conversationId1}'
          RETURNING *
        )
        INSERT INTO "conversations" ("conversationid1", "startdate", "enddate", "ani", "dnis", "direction", "divisionid")
        SELECT '${conversationId1}', '${conversationStart}', '${conversationEnd}', '${ani}', '${dnis}', '${direction}', '${divisionIds}'
        WHERE NOT EXISTS (SELECT * FROM upsert)`;

      await dbClient.query(upsertQuery);
      console.log("\n *** Conversation data upserted successfully ***");


    } catch (err) {
      console.error("Error fetching, storing, or deleting conversation details:", err);
    } finally {
      await dbClient.end();
    }
  } catch (err) {
    console.error("Error connecting to database:", err);
  }
}

getToken();
