#!/usr/bin/env ruby
# Adds the CuidalaWidget WidgetKit extension target to ios/App/App.xcodeproj.
#
# The extension's sources, Info.plist, entitlements, privacy manifest and
# strings have lived in ios/App/CuidalaWidget/ since M5-03, but no target ever
# referenced them, so the widget never shipped. Idempotent: re-running on a
# project that already has the target is a no-op.
#
#   ruby scripts/ios/add-widget-target.rb
require "xcodeproj"

PROJECT = File.expand_path("../../ios/App/App.xcodeproj", __dir__)
TARGET = "CuidalaWidget"
BUNDLE_ID = "com.cuidala.app.CuidalaWidget"

project = Xcodeproj::Project.open(PROJECT)
app = project.targets.find { |t| t.name == "App" } or abort("App target not found")
if project.targets.any? { |t| t.name == TARGET }
  puts "#{TARGET} target already present"
  exit 0
end

widget = project.new_target(:app_extension, TARGET, :ios, "16.4", nil, :swift)

group = project.main_group.find_subpath(TARGET, true)
group.set_source_tree("SOURCE_ROOT")
group.set_path(TARGET)

sources = %w[CuidalaWidget.swift CuidalaWidgetSnapshot.swift].map { |name| group.new_file(name) }
widget.add_file_references(sources)

privacy = group.new_file("PrivacyInfo.xcprivacy")
strings = group.new_variant_group("Localizable.strings")
%w[en es pt-BR].each do |lang|
  ref = strings.new_reference("#{lang}.lproj/Localizable.strings")
  ref.name = lang
end
widget.add_resources([privacy, strings])
group.new_file("Info.plist")
group.new_file("#{TARGET}.entitlements")

widget.build_configurations.each do |config|
  settings = config.build_settings
  settings["INFOPLIST_FILE"] = "#{TARGET}/Info.plist"
  settings["GENERATE_INFOPLIST_FILE"] = "NO"
  settings["CODE_SIGN_ENTITLEMENTS"] = "#{TARGET}/#{TARGET}.entitlements"
  settings["CODE_SIGN_STYLE"] = "Automatic"
  settings["PRODUCT_BUNDLE_IDENTIFIER"] = BUNDLE_ID
  settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
  settings["SWIFT_VERSION"] = "5.0"
  settings["IPHONEOS_DEPLOYMENT_TARGET"] = "16.4"
  settings["MARKETING_VERSION"] = "1.0"
  settings["CURRENT_PROJECT_VERSION"] = "2"
  settings["TARGETED_DEVICE_FAMILY"] = "1"
  settings["SKIP_INSTALL"] = "YES"
  settings["SWIFT_EMIT_LOC_STRINGS"] = "YES"
  settings["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
end

widget.add_system_framework("WidgetKit")
widget.add_system_framework("SwiftUI")

app.add_dependency(widget)
embed = app.build_phases.find { |phase| phase.isa == "PBXCopyFilesBuildPhase" && phase.name == "Embed Foundation Extensions" }
embed ||= app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:plug_ins]
embed.dst_path = ""
build_file = embed.add_file_reference(widget.product_reference)
build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "Added #{TARGET} (#{BUNDLE_ID}) and embedded it in App"
