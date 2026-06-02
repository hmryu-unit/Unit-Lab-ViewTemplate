using Autodesk.Revit.DB;
using UnitLab.ViewTemplate.Core.Models;
using UnitLab.ViewTemplate.Revit.Applicators;

namespace UnitLab.ViewTemplate.Revit;

public static class OverrideGraphicSettingsMerger
{
    public static void Apply(
        OverrideGraphicSettings ogs,
        GraphicStyleSpec? spec,
        GraphicSettingsScope scope,
        Document doc,
        ApplyContext context)
    {
        if (spec is null || spec.IsEmpty)
            return;

        var patterns = new RevitPatternResolver(doc);

        if (RevitColorParser.TryParse(spec.LineColor, out Color lineColor))
        {
            switch (scope)
            {
                case GraphicSettingsScope.Projection:
                    ogs.SetProjectionLineColor(lineColor);
                    break;
                case GraphicSettingsScope.Cut:
                    ogs.SetCutLineColor(lineColor);
                    break;
            }
        }
        else if (!string.IsNullOrWhiteSpace(spec.LineColor))
        {
            context.Warnings.Add($"선 색상 형식 오류: {spec.LineColor} (#RRGGBB)");
        }

        if (spec.LineWeight is >= 1 and <= 16)
        {
            switch (scope)
            {
                case GraphicSettingsScope.Projection:
                    ogs.SetProjectionLineWeight(spec.LineWeight.Value);
                    break;
                case GraphicSettingsScope.Cut:
                    ogs.SetCutLineWeight(spec.LineWeight.Value);
                    break;
            }
        }
        else if (spec.LineWeight.HasValue)
        {
            context.Warnings.Add($"선 두께는 1~16: {spec.LineWeight}");
        }

        ElementId? linePatternId = patterns.ResolveLinePattern(spec.LinePattern);
        if (linePatternId is not null)
        {
            switch (scope)
            {
                case GraphicSettingsScope.Projection:
                    ogs.SetProjectionLinePatternId(linePatternId);
                    break;
                case GraphicSettingsScope.Cut:
                    ogs.SetCutLinePatternId(linePatternId);
                    break;
            }
        }
        else if (!string.IsNullOrWhiteSpace(spec.LinePattern))
        {
            context.Warnings.Add($"선 패턴을 찾을 수 없음: {spec.LinePattern}");
        }

        ApplyFillAndTransparency(ogs, spec, scope, patterns, context);
    }

    private static void ApplyFillAndTransparency(
        OverrideGraphicSettings ogs,
        GraphicStyleSpec spec,
        GraphicSettingsScope scope,
        RevitPatternResolver patterns,
        ApplyContext context)
    {
        bool hasFill = !string.IsNullOrWhiteSpace(spec.FillColor) || !string.IsNullOrWhiteSpace(spec.FillPattern);
        if (!hasFill && !spec.Transparency.HasValue)
            return;

        if (RevitColorParser.TryParse(spec.FillColor, out Color fillColor))
        {
            switch (scope)
            {
                case GraphicSettingsScope.Projection:
                case GraphicSettingsScope.Surface:
                    ogs.SetSurfaceForegroundPatternColor(fillColor);
                    break;
                case GraphicSettingsScope.Cut:
                    ogs.SetCutForegroundPatternColor(fillColor);
                    break;
            }
        }
        else if (!string.IsNullOrWhiteSpace(spec.FillColor))
        {
            context.Warnings.Add($"면 색상 형식 오류: {spec.FillColor}");
        }

        ElementId? fillPatternId = patterns.ResolveFillPattern(spec.FillPattern);
        if (fillPatternId is not null)
        {
            switch (scope)
            {
                case GraphicSettingsScope.Projection:
                case GraphicSettingsScope.Surface:
                    ogs.SetSurfaceForegroundPatternId(fillPatternId);
                    break;
                case GraphicSettingsScope.Cut:
                    ogs.SetCutForegroundPatternId(fillPatternId);
                    break;
            }
        }
        else if (!string.IsNullOrWhiteSpace(spec.FillPattern))
        {
            context.Warnings.Add($"면 패턴을 찾을 수 없음: {spec.FillPattern}");
        }

        if (spec.Transparency is >= 0 and <= 100)
        {
            if (scope is GraphicSettingsScope.Projection or GraphicSettingsScope.Surface)
                ogs.SetSurfaceTransparency(spec.Transparency.Value);
        }
        else if (spec.Transparency.HasValue)
        {
            context.Warnings.Add($"투명도는 0~100: {spec.Transparency}");
        }
    }
}

public enum GraphicSettingsScope
{
    Projection,
    Cut,
    Surface
}
