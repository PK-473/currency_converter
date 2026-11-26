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
        CurrencyError: "CurrencyError",
        CacheWarning: "CacheWarning"
    },
    CacheTable: {
        EntityName: "cc_exchangeratecache",
        BaseCurrency: "cc_name",
        CachedResponse: "cc_cachedresponse",
        CachedExpiryUtc: "cc_cachedexpiryutc",
        LastSuccessfulRefreshUtc:
            "cc_lastsuccessfulrefreshutc"
    }
};



/**
 * Main OnSave handler.
 *
 * Process Flow:
 * 1. Runs only when "Convert Using" = JavaScript.
 * 2. Validates user-entered values.
 * 3. Retrieves exchange-rate data from cache or API.
 * 4. Performs currency conversion.
 * 5. Updates result and audit fields.
 * 6. Prevents save if no exchange-rate data is available.
 */
CurrencyConverter.onSave = async function (executionContext) {

    var formContext =
        executionContext.getFormContext();
    var saveEventArgs =
        executionContext.getEventArgs();

    try {

        formContext.ui.clearFormNotification(
            CurrencyConverter.Constants.NotificationIds.CurrencyError
        );

        formContext.ui.clearFormNotification(
            CurrencyConverter.Constants.NotificationIds.CacheWarning
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
                formContext,
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

    saveEventArgs.preventDefault();

    if (
        CurrencyConverter.isValidationError(
            error.message
        )
    ) {

        formContext.ui.setFormNotification(
            error.message,
            "ERROR",
            CurrencyConverter.Constants.NotificationIds.CurrencyError
        );

        return;
    }

    CurrencyConverter.clearResultFields(
        formContext
    );

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
 * Determines whether the error was caused by
 * user-entered validation failures rather than
 * an API or system error.
 */
CurrencyConverter.isValidationError =
    function (errorMessage) {

        return (
            errorMessage.includes("Convert From") ||
            errorMessage.includes("Convert To") ||
            errorMessage.includes("Amount")
        );
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

        var currencyRegex =
            /^[A-Z]{3}$/;

        if (
            !currencyRegex.test(
                convertFrom
            )
        ) {

            throw new Error(
                "Convert From must contain exactly 3 alphabetic characters (Example: USD, INR, EUR)."
            );
        }

        if (
            !currencyRegex.test(
                convertTo
            )
        ) {

            throw new Error(
                "Convert To must contain exactly 3 alphabetic characters (Example: USD, INR, EUR)."
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
 *
 * Strategy:
 * --------------------------
 * Valid Cache
 *      -> Use cache
 *
 * Expired Cache
 *      -> Call API
 *
 * API Success
 *      -> Update cache
 *
 * API Failure + Existing Cache
 *      -> Use stale cache
 *
 * API Failure + No Cache
 *      -> Throw error
 * --------------------------
 *
 * This design protects the solution from:
 * - API downtime
 * - Network issues
 * - API rate limiting
 * - Incorrect time_next_update_utc values
 */
CurrencyConverter.getExchangeRateData =
    async function (
        formContext,
        convertFrom,
        apiBaseUrl
    ) {

        // Try to retrieve an existing cache record
        var cacheRecord =
            await CurrencyConverter.getCacheRecord(
                convertFrom
            );

        // Check whether the cache is still valid
        if (
            cacheRecord &&
            CurrencyConverter.isCacheValid(
                cacheRecord
            )
        ) {

            console.log(
                "Using valid cached exchange rate data."
            );

            try {
                return JSON.parse(
                    cacheRecord.cc_cachedresponse
                );
            }
            catch {
                throw new Error(
                    "Cached exchange-rate data is invalid."
                );
            }
        }

        console.log(
            "Cache expired or not found. Calling API."
        );

        try {

            // Build the Exchange Rate API URL
            var apiUrl =
                apiBaseUrl +
                "/" +
                convertFrom;

            // Call the external API
            var response =
                await fetch(apiUrl);

            // Validate HTTP status
            if (!response.ok) {

                throw new Error(
                    "Exchange Rate API returned HTTP status " +
                    response.status
                );
            }

            // Parse API response
            var data =
                await response.json();

            // Validate API response
            if (
                data.result &&
                data.result !== "success"
            ) {

                throw new Error(
                    "Currency API returned: " +
                    (
                        data["error-type"] ||
                        "Unknown error"
                    )
                );
            }

            // Cache record already exists
            if (cacheRecord) {

                await CurrencyConverter.updateCacheRecord(
                    cacheRecord.cc_exchangeratecacheid,
                    data
                );
            }
            else {

                await CurrencyConverter.createCacheRecord(
                    convertFrom,
                    data
                );
            }

            console.log(
                "Cache successfully refreshed."
            );

            return data;
        }
        catch (apiError) {

            console.error(
                "API call failed.",
                apiError
            );

            // Fallback logic:
            // If old cache exists, use it even if expired.
            if (
                cacheRecord &&
                cacheRecord.cc_cachedresponse
            ) {

                formContext.ui.setFormNotification(
                    "Live exchange rates could not be retrieved. Using previously cached exchange rates.",
                    "WARNING",
                    CurrencyConverter.Constants.NotificationIds.CacheWarning
                );

                console.log(
                    "Using stale cache because API call failed."
                );

                try {

                    return JSON.parse(
                        cacheRecord.cc_cachedresponse
                    );
                }
                catch {

                    throw new Error(
                        "Cached exchange-rate data is invalid."
                    );
                }
            }

            // No cache available
            throw new Error(
                "Unable to retrieve exchange rates and no cached exchange rates are available."
            );
        }
    };

/**
 * Updates fields after successful conversion.
 */
CurrencyConverter.updateSuccessFields =
    function (
        formContext,
        convertedAmount
    ) {

        var conversionResult =
            formContext.getAttribute(
                CurrencyConverter.Constants.Fields.ConversionResult
            );

        var lastConversionDate =
            formContext.getAttribute(
                CurrencyConverter.Constants.Fields.LastConversionDate
            );

        var apiStatus =
            formContext.getAttribute(
                CurrencyConverter.Constants.Fields.ApiStatus
            );

        var apiErrorMessage =
            formContext.getAttribute(
                CurrencyConverter.Constants.Fields.ApiErrorMessage
            );

        formContext.ui.clearFormNotification(
            CurrencyConverter.Constants.NotificationIds.CurrencyError
        );

        formContext.ui.clearFormNotification(
            CurrencyConverter.Constants.NotificationIds.CacheWarning
        );

        if (conversionResult) {
            conversionResult.setValue(
                convertedAmount
            );
        }

        if (lastConversionDate) {
            lastConversionDate.setValue(
                new Date()
            );
        }

        if (apiStatus) {
            apiStatus.setValue(
                CurrencyConverter.Constants.ApiStatus.Success
            );
        }

        if (apiErrorMessage) {
            apiErrorMessage.setValue("");
        }
    };

/**
 * Updates fields after a failed conversion attempt.
 */
CurrencyConverter.updateFailureFields =
    function (
        formContext,
        errorMessage
    ) {

        var apiStatus =
            formContext.getAttribute(
                CurrencyConverter.Constants.Fields.ApiStatus
            );

        var apiErrorMessage =
            formContext.getAttribute(
                CurrencyConverter.Constants.Fields.ApiErrorMessage
            );

        if (apiStatus) {
            apiStatus.setValue(
                CurrencyConverter.Constants.ApiStatus.Failed
            );
        }

        if (apiErrorMessage) {
            apiErrorMessage.setValue(
                errorMessage
            );
        }
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

CurrencyConverter.clearResultFields =
    function (formContext) {

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.ConversionResult
            )
            ?.setValue(null);

        formContext
            .getAttribute(
                CurrencyConverter.Constants.Fields.LastConversionDate
            )
            ?.setValue(null);
    };

CurrencyConverter.getCacheRecord =
    async function (baseCurrency) {

        var query =
            "?$select=" +
            [
                "cc_exchangeratecacheid",
                CurrencyConverter.Constants.CacheTable.BaseCurrency,
                CurrencyConverter.Constants.CacheTable.CachedResponse,
                CurrencyConverter.Constants.CacheTable.CachedExpiryUtc,
                CurrencyConverter.Constants.CacheTable.LastSuccessfulRefreshUtc
            ].join(",") +
            "&$filter=" +
            CurrencyConverter.Constants.CacheTable.BaseCurrency +
            " eq '" +
            baseCurrency.replace(/'/g, "''") +
            "'" +
            "&$top=1";

        var result =
            await Xrm.WebApi.retrieveMultipleRecords(
                CurrencyConverter.Constants.CacheTable.EntityName,
                query
            );

        return result.entities.length > 0
            ? result.entities[0]
            : null;
    };

CurrencyConverter.isCacheValid =
    function (cacheRecord) {

        if (
            !cacheRecord ||
            !cacheRecord.cc_cachedexpiryutc
        ) {
            return false;
        }

        return (
            new Date(cacheRecord.cc_cachedexpiryutc) >
            new Date()
        );
    };

CurrencyConverter.createCacheRecord =
    async function (
        baseCurrency,
        apiResponse
    ) {

        var now =
            new Date();

        var expiry =
            new Date();

        expiry.setHours(
            expiry.getHours() + 24
        );

        var payload = {
            cc_name: baseCurrency,
            cc_cachedresponse:
                JSON.stringify(apiResponse),
            cc_cachedexpiryutc:
                expiry.toISOString(),
            cc_lastsuccessfulrefreshutc:
                now.toISOString()
        };

        await Xrm.WebApi.createRecord(
            "cc_exchangeratecache",
            payload
        );
    };

CurrencyConverter.updateCacheRecord =
    async function (
        recordId,
        apiResponse
    ) {

        var now =
            new Date();

        var expiry =
            new Date();

        expiry.setHours(
            expiry.getHours() + 24
        );

        var payload = {
            cc_cachedresponse:
                JSON.stringify(apiResponse),

            cc_cachedexpiryutc:
                expiry.toISOString(),

            cc_lastsuccessfulrefreshutc:
                now.toISOString()
        };

        await Xrm.WebApi.updateRecord(
            "cc_exchangeratecache",
            recordId,
            payload
        );
    };