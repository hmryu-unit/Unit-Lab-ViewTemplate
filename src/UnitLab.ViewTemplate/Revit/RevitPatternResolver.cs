using System;
using System.Linq;
using Autodesk.Revit.DB;

namespace UnitLab.ViewTemplate.Revit;

public sealed class RevitPatternResolver
{
    private readonly Document _document;

    public RevitPatternResolver(Document document) => _document = document;

    public ElementId? ResolveLinePattern(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;

        return new FilteredElementCollector(_document)
            .OfClass(typeof(LinePatternElement))
            .Cast<LinePatternElement>()
            .FirstOrDefault(p => p.Name.Equals(name.Trim(), StringComparison.OrdinalIgnoreCase))
            ?.Id;
    }

    public ElementId? ResolveFillPattern(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;

        return new FilteredElementCollector(_document)
            .OfClass(typeof(FillPatternElement))
            .Cast<FillPatternElement>()
            .FirstOrDefault(p => p.Name.Equals(name.Trim(), StringComparison.OrdinalIgnoreCase))
            ?.Id;
    }
}
