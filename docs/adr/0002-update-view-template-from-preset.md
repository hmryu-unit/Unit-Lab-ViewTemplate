# Update existing View Template from Preset JSON

A separate Revit command applies the same applicators as create (`ViewPropertiesApplicator`, `CategoryOverridesApplicator`) to an existing template matched by `preset.templateName`. Create still fails on duplicate names; update fails when the template is missing. `viewType` is not changed on update.

**Status:** accepted
