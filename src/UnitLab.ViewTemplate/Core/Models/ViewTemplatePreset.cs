using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace UnitLab.ViewTemplate.Core.Models;

/// <summary>
/// HTML 편집기 / 애드인이 공유하는 View Template Preset (JSON).
/// </summary>
public sealed class ViewTemplatePreset
{
    [JsonPropertyName("templateName")]
    public string TemplateName { get; set; } = string.Empty;

    [JsonPropertyName("viewType")]
    public string ViewType { get; set; } = "FloorPlan";

    [JsonPropertyName("properties")]
    public ViewPropertiesSpec? Properties { get; set; }

    [JsonPropertyName("categoryOverrides")]
    public List<CategoryOverrideSpec> CategoryOverrides { get; set; } = new();
}
