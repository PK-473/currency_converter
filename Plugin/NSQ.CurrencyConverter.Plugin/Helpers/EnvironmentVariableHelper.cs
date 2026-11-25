using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System;

namespace NSQ.CurrencyConverter.Plugin.Helpers
{
    public static class EnvironmentVariableHelper
    {
        public static string GetValue(
            IOrganizationService service,
            string schemaName)
        {
            QueryExpression query =
                new QueryExpression("environmentvariabledefinition");

            query.ColumnSet =
                new ColumnSet(
                    "schemaname",
                    "defaultvalue");

            query.Criteria.AddCondition(
                "schemaname",
                ConditionOperator.Equal,
                schemaName);

            query.LinkEntities.Add(
                new LinkEntity(
                    "environmentvariabledefinition",
                    "environmentvariablevalue",
                    "environmentvariabledefinitionid",
                    "environmentvariabledefinitionid",
                    JoinOperator.LeftOuter)
                {
                    EntityAlias = "value",
                    Columns = new ColumnSet("value")
                });

            EntityCollection result =
                service.RetrieveMultiple(query);

            if (result.Entities.Count == 0)
            {
                throw new InvalidPluginExecutionException(
                    $"Environment Variable not found: {schemaName}");
            }

            Entity env =
                result.Entities[0];

            if (
                env.Contains("value.value"))
            {
                return ((AliasedValue)env["value.value"])
                    .Value
                    ?.ToString();
            }

            return env.GetAttributeValue<string>(
                "defaultvalue");
        }
    }
}