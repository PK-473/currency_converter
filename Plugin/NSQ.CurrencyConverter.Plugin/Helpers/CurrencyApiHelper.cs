using Newtonsoft.Json;
using NSQ.CurrencyConverter.Plugin.Models;
using System.Net.Http;

namespace NSQ.CurrencyConverter.Plugin.Helpers
{
    public static class CurrencyApiHelper
    {
        public static ExchangeRateResponse GetRates(
            string apiBaseUrl,
            string convertFrom)
        {
            using (HttpClient client =
                new HttpClient())
            {
                string url =
                    $"{apiBaseUrl}/{convertFrom}";

                var response =
                    client
                    .GetAsync(url)
                    .Result;

                response.EnsureSuccessStatusCode();

                string json =
                    response.Content
                    .ReadAsStringAsync()
                    .Result;

                return JsonConvert.DeserializeObject<ExchangeRateResponse>(
                    json);
            }
        }
    }
}