var CurrencyConverter = CurrencyConverter || {};

/**
 * Application constants.
 * All option-set values, schema names and configuration values
 * are maintained in one place for easy maintenance.
 */
CurrencyConverter.Constants = {

    ConvertUsing: {
        JavaScript: 121440000,
        Plugin: 121440001
    },

    ApiStatus: {
        Success: 121440000,
        Failed: 121440001
    },

    Fields: {
        ConvertFrom: "cc_convertfrom",
        ConvertTo: "cc_convertto",
        AmountToConvert: "cc_amounttoconvert",
        ConvertUsing: "cc_convertusing",
        ConversionResult: "cc_conversionresult",
        LastConversionDate: "cc_lastconversiondate",
        ApiStatus: "cc_apistatus",
        ApiErrorMessage: "cc_apierrormessage"
    },

    EnvironmentVariables: {
        CurrencyApiUrl: "cc_CurrencyApiUrl",
        CurrencyApiKey: "cc_CurrencyApiKey"
    },

    NotificationIds: {
        CurrencyError: "CurrencyError"
    }
};

/**
 * In-memory cache.
 * Cache key = Source Currency
 * Example:
 * {
 *      "USD": { API Response },
 *      "EUR": { API Response }
 * }
 */
CurrencyConverter.ExchangeRateCache = {};

/**
 * Main OnSave Handler.
 * Executes only when Convert Using = JavaScript.
 */
CurrencyConverter.onSave = async function (executionContext) {

    var formContext = executionContext.getFormContext();

    try {

        formContext.ui.clearFormNotification(
            CurrencyConverter.Constants.NotificationIds.CurrencyError
        );

        // Retrieve all required attributes
        var attributes =
            CurrencyConverter.getAttributes(formContext);

        // Validate attribute references
        CurrencyConverter.validateAttributes(attributes);

        var convertFrom =
            attributes.convertFrom.getValue();

        var convertTo =
            attributes.convertTo.getValue();

        var amount =
            attributes.amount.getValue();

        var convertUsing =
            attributes.convertUsing.getValue();

        // Execute only for JavaScript conversion method
        if (
            convertUsing !==
            CurrencyConverter.Constants.ConvertUsing.JavaScript
        ) {
            return;
        }

        // Normalize user input
        convertFrom =
            convertFrom?.trim().toUpperCase() ?? "";

        convertTo =
            convertTo?.trim().toUpperCase() ?? "";

        // Update normalized values back to form
        attributes.convertFrom.setValue(convertFrom);
        attributes.convertTo.setValue(convertTo);

        // Business validation
        CurrencyConverter.validateInput(
            convertFrom,
            convertTo,
            amount
        );

        // Retrieve API URL from Environment Variable
        var apiBaseUrl =
            await CurrencyConverter.getEnvironmentVariable(
                CurrencyConverter.Constants
                    .EnvironmentVariables
                    .CurrencyApiUrl
            );

        // Retrieve exchange-rate information
        var data =
            await CurrencyConverter.getExchangeRateData(
                convertFrom,
                apiBaseUrl
            );

        // Ensure API returned rate information
        if (!data.rates) {

            throw new Error(
                "Exchange rate information was not returned by the API."
            );
        }

        // Ensure target currency exists
        if (
            data.rates[convertTo] === undefined
        ) {

            throw new Error(
                "Exchange rate not found for " +
                convertTo
            );
        }

        var rate =
            data.rates[convertTo];

        var convertedAmount =
            amount * rate;

        // Round to 2 decimal places
        convertedAmount =
            parseFloat(
                convertedAmount.toFixed(2)
            );

        // Update successful conversion values
        CurrencyConverter.updateSuccessFields(
            formContext,
            convertedAmount
        );

        console.log(
            "Currency conversion completed successfully."
        );
    }
    catch (error) {

        console.error(error);

        CurrencyConverter.updateFailureFields(
            formContext,
            error.message
        );

        formContext.ui.setFormNotification(
            error.message,
            "ERROR",
            CurrencyConverter.Constants.NotificationIds.CurrencyError
        );
    }
};

/**
 * Retrieves frequently used form attributes.
 */
CurrencyConverter.getAttributes =
    function (formContext) {

        return {

            convertFrom:
                formContext.getAttribute(
                    CurrencyConverter.Constants.Fields.ConvertFrom
                ),

            convertTo:
                formContext.getAttribute(
                    CurrencyConverter.Constants.Fields.ConvertTo
                ),

            amount:
                formContext.getAttribute(
                    CurrencyConverter.Constants.Fields.AmountToConvert
                ),

            convertUsing:
                formContext.getAttribute(
                    CurrencyConverter.Constants.Fields.ConvertUsing
                )
        };
    };

/**
 * Ensures required attributes exist on the form.
 */
CurrencyConverter.validateAttributes =
    function (attributes) {

        if (
            !attributes.convertFrom ||
            !attributes.convertTo ||
            !attributes.amount ||
            !attributes.convertUsing
        ) {

            throw new Error(
                "Required form fields are missing."
            );
        }
    };

/**
 * Validates user-entered values.
 */
CurrencyConverter.validateInput =
    function (
        convertFrom,
        convertTo,
        amount
    ) {

        if (
            !convertFrom ||
            convertFrom.length !== 3
        ) {

            throw new Error(
                "Convert From must be a valid 3-character currency code."
            );
        }

        if (
            !convertTo ||
            convertTo.length !== 3
        ) {

            throw new Error(
                "Convert To must be a valid 3-character currency code."
            );
        }

        if (
            amount === null ||
            amount === undefined ||
            amount <= 0
        ) {

            throw new Error(
                "Amount must be greater than zero."
            );
        }
    };

/**
 * Retrieves exchange-rate information.
 * Uses cache when data already exists.
 */
CurrencyConverter.getExchangeRateData =
    async function (
        convertFrom,
        apiBaseUrl
    ) {

        if (
            CurrencyConverter.ExchangeRateCache[convertFrom]
        ) {

            console.log(
                "Using cached exchange-rate data for " +
                convertFrom
            );

            return CurrencyConverter
                .ExchangeRateCache[convertFrom];
        }

        var apiUrl =
            apiBaseUrl +
            "/" +
            convertFrom;

        console.log(
            "Fetching exchange rates from API..."
        );

        var response =
            await fetch(apiUrl);

        if (!response.ok) {

            throw new Error(
                "API returned status " +
                response.status
            );
        }

        var data =
            await response.json();

        CurrencyConverter.ExchangeRateCache[
            convertFrom
        ] = data;

        return data;
    };

/**
 * Updates fields after successful conversion.
 */
CurrencyConverter.updateSuccessFields =
    function (
        formContext,
        convertedAmount
    ) {

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.ConversionResult
            )
            .setValue(
                convertedAmount
            );

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.LastConversionDate
            )
            .setValue(
                new Date()
            );

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.ApiStatus
            )
            .setValue(
                CurrencyConverter.Constants.ApiStatus.Success
            );

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.ApiErrorMessage
            )
            .setValue("");
    };

/**
 * Updates fields after a failed conversion attempt.
 */
CurrencyConverter.updateFailureFields =
    function (
        formContext,
        errorMessage
    ) {

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.ApiStatus
            )
            .setValue(
                CurrencyConverter.Constants.ApiStatus.Failed
            );

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.ApiErrorMessage
            )
            .setValue(
                errorMessage
            );
    };

/**
 * Retrieves Environment Variable value.
 * Uses Current Value when available.
 * Falls back to Default Value.
 */
CurrencyConverter.getEnvironmentVariable =
    async function (schemaName) {   

        var query =
            "?$select=schemaname,defaultvalue" +
            "&$filter=schemaname eq '" + schemaName + "'" +
            "&$expand=environmentvariabledefinition_environmentvariablevalue($select=value)";

        var result =
            await Xrm.WebApi.retrieveMultipleRecords(
                "environmentvariabledefinition",
                query
            );

        if (result.entities.length === 0) {

            throw new Error(
                "Environment Variable not found: " +
                schemaName
            );
        }

        var envVar =
            result.entities[0];

        if (
            envVar.environmentvariabledefinition_environmentvariablevalue &&
            envVar.environmentvariabledefinition_environmentvariablevalue.length > 0
        ) {

            return envVar
                .environmentvariabledefinition_environmentvariablevalue[0]
                .value;
        }

        return envVar.defaultvalue;
    };