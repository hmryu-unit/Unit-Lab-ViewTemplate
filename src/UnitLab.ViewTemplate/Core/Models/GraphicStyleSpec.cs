using System.Text.Json.Serialization;

namespace UnitLab.ViewTemplate.Core.Models;

/// <summary>
/// V/G 재지정 — 선/면 스타일 (Projection, Cut, Surface).
/// 색상: #RRGGBB. 패턴: 문서 내 Line/Fill Pattern 이름.
/// </summary>
public sealed class GraphicStyleSpec
{
    [JsonPropertyName("lineColor")]
    public string? LineColor { get; set; }

    [JsonPropertyName("lineWeight")]
    public int? LineWeight { get; set; }

    [JsonPropertyName("linePattern")]
    public string? LinePattern { get; set; }

    [JsonPropertyName("fillColor")]
    public string? FillColor { get; set; }

    [JsonPropertyName("fillPattern")]
    public string? FillPattern { get; set; }

    [JsonPropertyName("transparency")]
    public int? Transparency { get; set; }

    public bool IsEmpty =>
        string.IsNullOrWhiteSpace(LineColor)
        && !LineWeight.HasValue
        && string.IsNullOrWhiteSpace(LinePattern)
        && string.IsNullOrWhiteSpace(FillColor)
        && string.IsNullOrWhiteSpace(FillPattern)
        && !Transparency.HasValue;
}
