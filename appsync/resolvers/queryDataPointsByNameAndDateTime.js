import { util } from "@aws-appsync/utils";

export function request(ctx) {
  let scanIndexFwd = true;
  if (ctx.args.sortDirection && ctx.args.sortDirection == "DESC") {
    scanIndexFwd = false;
  }
  let filter = ctx.args.filter;
  if (ctx.args.filter) {
    filter = JSON.parse(
      util.transform.toDynamoDBFilterExpression(ctx.args.filter)
    );
  }
  const expression = getExpression(ctx.args.createdAt, ctx.args.name);
  return {
    operation: "Query",
    query: {
      expression: expression?.comparison_str,
      expressionNames: { "#name": "name" },
      expressionValues: expression?.expressionValues,
    },
    limit: ctx.args.limit,
    filter: filter,
    nextToken: ctx.args.nextToken,
    scanIndexForward: scanIndexFwd,
  };
}

function getExpression(createdAt, name) {
  let comparison_str = "#name = :name";
  let expressionValues = {
    ":name": util.dynamodb.toDynamoDB(name),
  };
  if (createdAt) {
    if (createdAt.beginsWith) {
      comparison_str += " and begins_with(createdAt, :date)";
      expressionValues[":date"] = util.dynamodb.toDynamoDB(
        createdAt.beginsWith
      );
    } else if (createdAt.eq) {
      comparison_str += " and createdAt = :date";
      expressionValues[":date"] = util.dynamodb.toDynamoDB(createdAt.eq);
    } else if (createdAt.lt) {
      comparison_str += " and createdAt < :date";
      expressionValues[":date"] = util.dynamodb.toDynamoDB(createdAt.lt);
    } else if (createdAt.le) {
      comparison_str += " and createdAt <= :date";
      expressionValues[":date"] = util.dynamodb.toDynamoDB(createdAt.le);
    } else if (createdAt.gt) {
      comparison_str += " and createdAt > :date";
      expressionValues[":date"] = util.dynamodb.toDynamoDB(createdAt.gt);
    } else if (createdAt.ge) {
      comparison_str += " and createdAt >= :date";
      expressionValues[":date"] = util.dynamodb.toDynamoDB(createdAt.ge);
    } else if (createdAt.between) {
      comparison_str += " and createdAt BETWEEN :start AND :end";
      expressionValues[":start"] = util.dynamodb.toDynamoDB(
        createdAt.between[0]
      );
      expressionValues[":end"] = util.dynamodb.toDynamoDB(createdAt.between[1]);
    }
  }
  return { comparison_str, expressionValues };
}

export function response(ctx) {
  const { error, result } = ctx;
  if (error) {
    return util.appendError(error.message, error.type, result);
  }
  return result;
}
