import AVFoundation
import AVKit
import ExpoModulesCore
import UIKit
import WebRTC

private func bluetoothOption() -> AVAudioSession.CategoryOptions {
  // `.allowBluetoothHFP` replaces `.allowBluetooth` in the Xcode 26 SDK.
  #if swift(>=6.2)
  return .allowBluetoothHFP
  #else
  return .allowBluetooth
  #endif
}

private func categoryOptions(_ names: [String]) -> AVAudioSession.CategoryOptions {
  var options: AVAudioSession.CategoryOptions = []
  for name in names {
    switch name {
    case "allowBluetooth": options.insert(bluetoothOption())
    case "allowBluetoothA2DP": options.insert(.allowBluetoothA2DP)
    case "allowAirPlay": options.insert(.allowAirPlay)
    case "defaultToSpeaker": options.insert(.defaultToSpeaker)
    case "mixWithOthers": options.insert(.mixWithOthers)
    case "duckOthers": options.insert(.duckOthers)
    default: break
    }
  }
  return options
}

private func audioMode(_ name: String?) -> AVAudioSession.Mode {
  switch name {
  case "voiceChat": return .voiceChat
  case "default": return .default
  default: return .videoChat
  }
}

private func audioCategory(_ name: String?) -> AVAudioSession.Category {
  name == "playback" ? .playback : .playAndRecord
}

/**
 * The ReplayKit picker gives no result, and WebRTC's screen track is live before
 * any frame arrives. The broadcast extension posts this Darwin notification when
 * the user taps Start Broadcast, so sharing only begins once it really started.
 */
private final class ScreenBroadcastWaiter {
  static let shared = ScreenBroadcastWaiter()

  private var pending: [UUID: (Bool) -> Void] = [:]
  private var observers: [UUID: [NSObjectProtocol]] = [:]

  private init() {
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      { _, observer, _, _, _ in
        guard let observer else { return }
        let waiter = Unmanaged<ScreenBroadcastWaiter>.fromOpaque(observer).takeUnretainedValue()
        DispatchQueue.main.async { waiter.finishAll(started: true) }
      },
      "iOS_BroadcastStarted" as CFString,
      nil,
      .deliverImmediately
    )
  }

  /// Main queue only. Resolves false on timeout, or shortly after the picker closes
  /// without a start (Start Broadcast counts down ~3s before the extension starts).
  func wait(timeout: TimeInterval, completion: @escaping (Bool) -> Void) {
    let id = UUID()
    pending[id] = completion
    var pickerShown = false
    let center = NotificationCenter.default
    observers[id] = [
      center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { _ in
        pickerShown = true
      },
      center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) {
        [weak self] _ in
        guard pickerShown else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) { self?.finish(id, started: false) }
      },
    ]
    DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
      self?.finish(id, started: false)
    }
  }

  private func finish(_ id: UUID, started: Bool) {
    guard let completion = pending.removeValue(forKey: id) else { return }
    observers.removeValue(forKey: id)?.forEach { NotificationCenter.default.removeObserver($0) }
    completion(started)
  }

  private func finishAll(started: Bool) {
    for id in Array(pending.keys) { finish(id, started: started) }
  }
}

public final class CallAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CallAudio")

    OnCreate {
      // WebRTC activates the session itself on the first audio track; make its
      // default a speaker-friendly video call instead of a handset voice call.
      let config = RTCAudioSessionConfiguration.webRTC()
      config.category = AVAudioSession.Category.playAndRecord.rawValue
      config.categoryOptions = [.allowAirPlay, bluetoothOption(), .allowBluetoothA2DP, .defaultToSpeaker]
      config.mode = AVAudioSession.Mode.videoChat.rawValue
      RTCAudioSessionConfiguration.setWebRTC(config)
    }

    AsyncFunction("configureAndroid") { (_: [String: Any]) in }

    AsyncFunction("configureApple") { (options: [String: Any]) in
      let config = RTCAudioSessionConfiguration.webRTC()
      config.category = audioCategory(options["category"] as? String).rawValue
      if let names = options["categoryOptions"] as? [String] {
        config.categoryOptions = categoryOptions(names)
      }
      config.mode = audioMode(options["mode"] as? String).rawValue
      RTCAudioSessionConfiguration.setWebRTC(config)

      let session = RTCAudioSession.sharedInstance()
      session.lockForConfiguration()
      defer { session.unlockForConfiguration() }
      try session.setConfiguration(config)
    }

    AsyncFunction("start") {
      let session = RTCAudioSession.sharedInstance()
      session.lockForConfiguration()
      defer { session.unlockForConfiguration() }
      try session.setActive(true)
    }

    AsyncFunction("stop") {
      let session = RTCAudioSession.sharedInstance()
      session.lockForConfiguration()
      defer { session.unlockForConfiguration() }
      try session.setActive(false)
    }

    AsyncFunction("getOutputs") { () -> [String] in
      ["default", "force_speaker"]
    }

    AsyncFunction("selectOutput") { (outputId: String) in
      let session = AVAudioSession.sharedInstance()
      if outputId == "force_speaker" {
        try session.overrideOutputAudioPort(.speaker)
      } else {
        try session.overrideOutputAudioPort(.none)
      }
    }

    AsyncFunction("waitForScreenBroadcast") { (timeoutMs: Double, promise: Promise) in
      ScreenBroadcastWaiter.shared.wait(timeout: timeoutMs / 1000) { promise.resolve($0) }
    }.runOnQueue(.main)

    AsyncFunction("showRoutePicker") {
      let picker = AVRoutePickerView()
      for case let button as UIButton in picker.subviews {
        button.sendActions(for: .touchUpInside)
        break
      }
    }.runOnQueue(.main)
  }
}
