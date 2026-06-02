using System.IO;
using System.Text.Json;
using UnitLab.ViewTemplate.Core.Models;

namespace UnitLab.ViewTemplate.Core.Presets;

public static class JsonPresetLoader
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        WriteIndented = true
    };

    public static ViewTemplatePreset LoadFromFile(string path)
    {
        string json = File.ReadAllText(path);
        return Load(json);
    }

    public static ViewTemplatePreset Load(string json)
    {
        var preset = JsonSerializer.Deserialize<ViewTemplatePreset>(json, Options)
            ?? throw new InvalidDataException("Preset JSON을 파싱할 수 없습니다.");

        if (string.IsNullOrWhiteSpace(preset.TemplateName))
            throw new InvalidDataException("templateName은 필수입니다.");

        return preset;
    }

    public static void SaveToFile(ViewTemplatePreset preset, string path)
    {
        string json = JsonSerializer.Serialize(preset, Options);
        File.WriteAllText(path, json);
    }
}
