using System.Text.Json.Serialization;

namespace UnitLab.ViewTemplate.Core.Models;

public sealed class CategoryOverrideSpec
{
    [JsonPropertyName("builtInCategory")]
    public string BuiltInCategory { get; set; } = string.Empty;

    [JsonPropertyName("hidden")]
    public bool? Hidden { get; set; }

    [JsonPropertyName("halftone")]
    public bool? Halftone { get; set; }

    [JsonPropertyName("projection")]
    public GraphicStyleSpec? Projection { get; set; }

    [JsonPropertyName("cut")]
    public GraphicStyleSpec? Cut { get; set; }

    [JsonPropertyName("surface")]
    public GraphicStyleSpec? Surface { get; set; }
}
