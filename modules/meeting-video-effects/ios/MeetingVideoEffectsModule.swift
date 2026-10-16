import ExpoModulesCore

public final class MeetingVideoEffectsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MeetingVideoEffects")

    Function("registerProcessor") { () -> Bool in
      MeetingVideoEffectsProcessor.register()
      return true
    }

    Function("configure") { (options: [String: Any]) in
      let mode = options["mode"] as? String ?? "off"
      let imagePath = options["imagePath"] as? String
      let blurRadius = options["blurRadius"] as? Double ?? 12
      let filter = options["filter"] as? String ?? "none"
      MeetingVideoEffectsProcessor.configureMode(
        mode,
        imagePath: imagePath,
        blurRadius: blurRadius,
        filter: filter
      )
    }

    Function("isSupported") { () -> Bool in
      MeetingVideoEffectsProcessor.isSupported()
    }
  }
}
