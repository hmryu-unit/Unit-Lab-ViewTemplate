/** categories.json 과 동기화 — file:// 에서도 동작 */
window.CATEGORY_CATALOG = {
  groups: [
    {
      name: "건축 · 구조",
      categories: [
        "Walls", "Floors", "Roofs", "Ceilings", "Columns", "StructuralColumns",
        "StructuralFraming", "StructuralFoundation", "StructuralStiffeners", "StructuralConnections",
        "Stairs", "StairsLandings", "StairsSupports", "Railings", "Ramps", "ShaftOpenings",
        "Doors", "Windows", "CurtainWallPanels", "CurtainWallMullions", "CurtainSystems",
        "Furniture", "FurnitureSystems", "GenericModel", "Casework", "SpecialityEquipment",
        "MechanicalEquipment", "ElectricalEquipment", "PlumbingFixtures", "LightingFixtures",
        "Rooms", "Areas", "Spaces", "Mass", "Parts", "DivisionProfile"
      ]
    },
    {
      name: "MEP",
      categories: [
        "Ducts", "DuctFittings", "DuctAccessories", "DuctInsulations", "DuctLinings",
        "FlexDuctCurves", "Pipes", "PipeFittings", "PipeAccessories", "PipeInsulations",
        "FlexPipeCurves", "CableTray", "CableTrayFittings", "Conduit", "ConduitFitting",
        "ElectricalFixtures", "LightingDevices", "CommunicationDevices", "DataDevices",
        "FireAlarmDevices", "SecurityDevices", "TelephoneDevices", "NurseCallDevices",
        "Sprinklers", "MechanicalControlDevices", "ZoneEquipment", "AirTerminals",
        "HVACZones", "ElectricalCircuit", "Wire", "MEPSpaces"
      ]
    },
    {
      name: "Site · 외부",
      categories: [
        "Site", "Topography", "TopographyLink", "Roads", "Parking", "Planting",
        "Entourage", "BuildingPad", "Property", "PropertyLineSegment", "PropertyLineSegmentTags"
      ]
    },
    {
      name: "좌표 · 참조",
      categories: [
        "Levels", "Grids", "ReferenceLines", "ReferencePoints", "SharedBasePoint",
        "ProjectBasePoint", "SurveyPoint", "InternalAreaLoadTags", "SpanDirectionSymbol"
      ]
    },
    {
      name: "주석 · 태그",
      categories: [
        "Dimensions", "SpotDimensions", "TextNotes", "GenericAnnotation", "Tags",
        "MultiCategoryTags", "RoomTags", "AreaTags", "SpaceTags", "DoorTags", "WindowTags",
        "WallTags", "FloorTags", "RoofTags", "StairsTags", "StructuralFramingTags",
        "StructuralColumnTags", "StructuralFoundationTags", "MechanicalEquipmentTags",
        "SectionMarks", "Callouts", "Elevations", "Viewers", "Cameras", "Sections",
        "DetailComponents", "DetailComponentTags", "FilledRegion", "MaskingRegion",
        "RevisionClouds", "GridHeads", "LevelHeads"
      ]
    },
    {
      name: "분석 · 기타",
      categories: [
        "AnalyticalNodes", "AnalyticalMember", "AnalyticalOpening", "AnalyticalPanel",
        "AnalyticalLink", "Loads", "InternalLoads", "PointClouds", "RasterImages",
        "ImportObjectStyles", "AudioVisualDevices", "FoodServiceEquipment",
        "MedicalEquipment", "VerticalCirculation", "VibrationManagement", "VibrationIsolators"
      ]
    }
  ]
};
