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
      MeetingVideoEffectsProcessor.configureMode(
        mode,
        imagePath: imagePath,
        blurRadius: blurRadius
      )
    }

    Function("isSupported") { () -> Bool in
      MeetingVideoEffectsProcessor.isSupported()
    }
  }
}
