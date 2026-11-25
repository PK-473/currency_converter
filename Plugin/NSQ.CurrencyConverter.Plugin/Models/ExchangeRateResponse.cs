using Newtonsoft.Json;
using System.Collections.Generic;

namespace NSQ.CurrencyConverter.Plugin.Models
{
    public class ExchangeRateResponse
    {
        [JsonProperty("result")]
        public string Result { get; set; }

        [JsonProperty("rates")]
        public Dictionary<string, decimal> Rates { get; set; }
    }
}