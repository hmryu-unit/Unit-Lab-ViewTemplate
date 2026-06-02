using Autodesk.Revit.DB;
using UnitLab.ViewTemplate.Revit.Applicators;

namespace UnitLab.ViewTemplate.Revit.Services;

public sealed class CreateTemplateResult
{
    public required View Template { get; init; }

    public required ApplyContext Context { get; init; }
}
