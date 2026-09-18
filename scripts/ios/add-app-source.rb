#!/usr/bin/env ruby
# Adds Swift files under ios/App/App/ to the App target's Sources phase.
# Idempotent. Usage: ruby scripts/ios/add-app-source.rb WeatherRefresh.swift [...]
require "xcodeproj"

PROJECT = File.expand_path("../../ios/App/App.xcodeproj", __dir__)
project = Xcodeproj::Project.open(PROJECT)
app = project.targets.find { |t| t.name == "App" } or abort("App target not found")
group = project.main_group.find_subpath("App", false) or abort("App group not found")

ARGV.each do |name|
  existing = group.files.find { |f| f.path == name }
  ref = existing || group.new_file(name)
  if app.source_build_phase.files_references.include?(ref)
    puts "#{name} already in App sources"
  else
    app.add_file_references([ref])
    puts "added #{name} to App sources"
  end
end
project.save
