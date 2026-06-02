using System;
using System.Linq;
using Autodesk.Revit.DB;

namespace UnitLab.ViewTemplate.Revit;

internal static class SeedViewFactory
{
    public static View CreateSeedView(Document doc, string viewType)
    {
        return viewType.Trim().Replace(" ", string.Empty).ToUpperInvariant() switch
        {
            "FLOORPLAN" => CreateFloorPlan(doc),
            "CEILINGPLAN" => CreateCeilingPlan(doc),
            _ => throw new NotSupportedException($"지원하지 않는 viewType: {viewType}")
        };
    }

    private static ViewPlan CreateFloorPlan(Document doc) =>
        CreatePlan(doc, ViewFamily.FloorPlan);

    private static ViewPlan CreateCeilingPlan(Document doc) =>
        CreatePlan(doc, ViewFamily.CeilingPlan);

    private static ViewPlan CreatePlan(Document doc, ViewFamily family)
    {
        Level? level = new FilteredElementCollector(doc)
            .OfClass(typeof(Level))
            .Cast<Level>()
            .OrderBy(l => l.Elevation)
            .FirstOrDefault()
            ?? throw new System.InvalidOperationException("문서에 Level이 없습니다.");

        ViewFamilyType? viewFamilyType = new FilteredElementCollector(doc)
            .OfClass(typeof(ViewFamilyType))
            .Cast<ViewFamilyType>()
            .FirstOrDefault(vft => vft.ViewFamily == family)
            ?? throw new System.InvalidOperationException($"{family} ViewFamilyType을 찾을 수 없습니다.");

        return ViewPlan.Create(doc, viewFamilyType.Id, level.Id);
    }
}
