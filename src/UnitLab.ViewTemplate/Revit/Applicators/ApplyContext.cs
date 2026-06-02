using System.Collections.Generic;
using Autodesk.Revit.DB;

namespace UnitLab.ViewTemplate.Revit.Applicators;

public sealed class ApplyContext
{
    public ApplyContext(Document document) => Document = document;

    public Document Document { get; }

    public List<string> Warnings { get; } = new();
}
