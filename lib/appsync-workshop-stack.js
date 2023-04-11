// 1. Import dependencies
const cdk = require("aws-cdk-lib");
const db = require("aws-cdk-lib/aws-dynamodb");
const appsync = require("aws-cdk-lib/aws-appsync");

// 2. setup a static expiration date for the API KEY
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const WORKSHOP_DATE = new Date(); // date of this workshop
WORKSHOP_DATE.setHours(0);
WORKSHOP_DATE.setMinutes(0);
WORKSHOP_DATE.setSeconds(0);
WORKSHOP_DATE.setMilliseconds(0);
const KEY_EXPIRATION_DATE = new Date(WORKSHOP_DATE.getTime() + SEVEN_DAYS);

class AppsyncWorkshopStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // 3. Define your AppSync API
    const api = new appsync.GraphqlApi(this, "WorkshopAPI", {
      name: "WorkshopAPI",
      // 3. a. create schema using our schema definition
      schema: appsync.SchemaFile.fromAsset("appsync/schema.graphql"),
      // 3. b. Authorization mode
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: "API_KEY",
          apiKeyConfig: {
            name: "default",
            description: "default auth mode",
            expires: cdk.Expiration.atDate(KEY_EXPIRATION_DATE),
          },
        },
      },
    });

    // 4. Define the DynamoDB table with partition key and sort key
    const table = new db.Table(this, "DataPointTable", {
      partitionKey: { name: "name", type: db.AttributeType.STRING },
      sortKey: { name: "createdAt", type: db.AttributeType.STRING },
    });

    // 5. Set up table as a Datasource and grant access
    const dataSource = api.addDynamoDbDataSource("dataPointSource", table);

    // 6. Define resolvers
    const createDataPointFunction = dataSource.createFunction(
      "CreateDataPointFunction",
      {
        name: "CreateDataPointFunction",
        code: appsync.Code.fromAsset(
          "appsync/resolvers/mutationCreateDataPoint.js"
        ),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      }
    );

    const queryDataPointsDateTimeFunction = dataSource.createFunction(
      "QueryDataPointsDateTimeFunction",
      {
        name: "QueryDataPointsDateTimeFunction",
        api,
        dataSource: dataSource,
        code: appsync.Code.fromAsset(
          "appsync/resolvers/queryDataPointsByNameAndDateTime.js"
        ),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      }
    );

    const pipelineReqResCode = appsync.Code.fromInline(`
        export function request(ctx) {
          return {}
        }
    
        export function response(ctx) {
          return ctx.prev.result
        }
    `);

    api.createResolver("CreateDataPointPipelineResolver", {
      typeName: "Mutation",
      fieldName: "createDataPoint",
      code: pipelineReqResCode,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [createDataPointFunction],
    });

    api.createResolver("QueryNameDateTimePipelineResolver", {
      typeName: "Query",
      fieldName: "queryDataPointsByNameAndDateTime",
      code: pipelineReqResCode,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [queryDataPointsDateTimeFunction],
    });

    // 7. Stack Outputs
    new cdk.CfnOutput(this, "GraphQLAPI_ID", { value: api.apiId });
    new cdk.CfnOutput(this, "GraphQLAPI_URL", { value: api.graphqlUrl });
    new cdk.CfnOutput(this, "GraphQLAPI_KEY", { value: api.apiKey });
    new cdk.CfnOutput(this, "STACK_REGION", { value: this.region });
  }
}

module.exports = { AppsyncWorkshopStack };
