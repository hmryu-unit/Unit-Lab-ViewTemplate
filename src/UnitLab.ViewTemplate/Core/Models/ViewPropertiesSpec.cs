using System.Text.Json.Serialization;

namespace UnitLab.ViewTemplate.Core.Models;

public sealed class ViewPropertiesSpec
{
    [JsonPropertyName("discipline")]
    public string? Discipline { get; set; }

    [JsonPropertyName("detailLevel")]
    public string? DetailLevel { get; set; }
}
