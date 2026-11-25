using Microsoft.Xrm.Sdk;
using NSQ.CurrencyConverter.Plugin.Helpers;
using System;
using System.Linq;

namespace NSQ.CurrencyConverter.Plugin
{
    public class CurrencyConverterPlugin : IPlugin
    {
        private const int PluginOption = 121440001;

        private const int SuccessStatus = 121440000;
        private const int FailedStatus = 121440001;

        public void Execute(
            IServiceProvider serviceProvider)
        {
            IPluginExecutionContext context =
                (IPluginExecutionContext)
                serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            IOrganizationServiceFactory factory =
                (IOrganizationServiceFactory)
                serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            IOrganizationService service =
                factory.CreateOrganizationService(
                    context.UserId);

            if (!context.InputParameters.Contains("Target"))
            {
                return;
            }

            Entity target =
                (Entity)context.InputParameters["Target"];

            if (
                target.LogicalName !=
                "cc_currencyconvertor")
            {
                return;
            }

            try
            {
                int? convertUsing =
                    target.GetAttributeValue<OptionSetValue>(
                        "cc_convertusing")?.Value;

                if (convertUsing != PluginOption)
                {
                    return;
                }

                string convertFrom =
                    target.GetAttributeValue<string>(
                        "cc_convertfrom");

                string convertTo =
                    target.GetAttributeValue<string>(
                        "cc_convertto");

                decimal amount =
                    target.GetAttributeValue<decimal>(
                        "cc_amounttoconvert");

                ValidateCurrencyCode(
                    convertFrom,
                    "Convert From");

                ValidateCurrencyCode(
                    convertTo,
                    "Convert To");

                string apiUrl =
                    EnvironmentVariableHelper.GetValue(
                        service,
                        "cc_CurrencyApiUrl");

                var apiResponse =
                    CurrencyApiHelper.GetRates(
                        apiUrl,
                        convertFrom);

                if (
                    apiResponse?.Rates == null ||
                    !apiResponse.Rates.ContainsKey(
                        convertTo))
                {
                    throw new Exception(
                        $"Rate not found for {convertTo}");
                }

                decimal rate =
                    apiResponse.Rates[convertTo];

                decimal result =
                    Math.Round(
                        amount * rate,
                        2);

                target["cc_conversionresult"] =
                    result;

                target["cc_lastconversiondate"] =
                    DateTime.UtcNow;

                target["cc_apistatus"] =
                    new OptionSetValue(
                        SuccessStatus);

                target["cc_apierrormessage"] =
                    string.Empty;
            }
            catch (
                InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                target["cc_apistatus"] =
                    new OptionSetValue(
                        FailedStatus);

                target["cc_apierrormessage"] =
                    ex.Message;
            }
        }

        private static void ValidateCurrencyCode(
        string code,
        string fieldName)
        {
            if (
                string.IsNullOrWhiteSpace(code) ||
                code.Length != 3 ||
                !code.All(char.IsLetter)
            )
            {
                throw new InvalidPluginExecutionException(
                    $"{fieldName} must contain exactly 3 alphabetic characters (Example: USD, INR, EUR)."
                );
            }
        }
    }
}