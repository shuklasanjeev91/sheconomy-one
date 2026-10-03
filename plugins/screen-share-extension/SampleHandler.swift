//
//  SampleHandler.swift
//  Broadcast Extension
//
//  Created by Alex-Dan Bumbu on 04.06.2021.
//

import ReplayKit

private enum Constants {
    // the App Group ID value that the app and the broadcast extension targets are setup with. It differs for each app.
    static let appGroupIdentifier = "group.com.jitsi.example-screensharing.appgroup"
    /// Upper bound on frames sent to the app (screen content, not motion video).
    static let frameInterval: TimeInterval = 1.0 / 15.0
    /// ReplayKit stops delivering frames while the screen is static; repeat the last one
    /// so the encoder can answer keyframe requests and late joiners never see black.
    static let repeatInterval: TimeInterval = 0.5
}

class SampleHandler: RPBroadcastSampleHandler {
    
    private var clientConnection: SocketConnection?
    private var uploader: SampleUploader?

    private let frameQueue = DispatchQueue(label: "broadcast.frames")
    private var frameTimer: DispatchSourceTimer?
    private let frameLock = NSLock()
    private var latestFrame: CVPixelBuffer?
    private var latestOrientation: UInt = 0
    private var latestFrameId = 0
    // frameQueue only
    private var sentFrameId = 0
    private var lastSentAt: CFTimeInterval = 0
    
    var socketFilePath: String {
      let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Constants.appGroupIdentifier)
        return sharedContainer?.appendingPathComponent("rtc_SSFD").path ?? ""
    }
    
    override init() {
      super.init()
        if let connection = SocketConnection(filePath: socketFilePath) {
          clientConnection = connection
          setupConnection()
          
          uploader = SampleUploader(connection: connection)
        }
    }

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        // User has requested to start the broadcast. Setup info from the UI extension can be supplied but optional.
        DarwinNotificationCenter.shared.postNotification(.broadcastStarted)
        openConnection()
        startFrameTimer()
    }
    
    override func broadcastPaused() {
        // User has requested to pause the broadcast. Samples will stop being delivered.
    }
    
    override func broadcastResumed() {
        // User has requested to resume the broadcast. Samples delivery will resume.
    }
    
    override func broadcastFinished() {
        // User has requested to finish the broadcast.
        stopFrameTimer()
        DarwinNotificationCenter.shared.postNotification(.broadcastStopped)
        clientConnection?.close()
    }
    
    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }
        let orientation = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil)?.uintValue ?? 0

        frameLock.lock()
        latestFrame = pixelBuffer
        latestOrientation = orientation
        latestFrameId += 1
        frameLock.unlock()
    }
}

private extension SampleHandler {
  
    func setupConnection() {
        clientConnection?.didClose = { [weak self] error in
            print("client connection did close \(String(describing: error))")
          
            if let error = error {
                self?.finishBroadcastWithError(error)
            } else {
                // the displayed failure message is more user friendly when using NSError instead of Error
                let JMScreenSharingStopped = 10001
                let customError = NSError(domain: RPRecordingErrorDomain, code: JMScreenSharingStopped, userInfo: [NSLocalizedDescriptionKey: "Screen sharing stopped"])
                self?.finishBroadcastWithError(customError)
            }
        }
    }
    
    func openConnection() {
        let queue = DispatchQueue(label: "broadcast.connectTimer")
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(500))
        timer.setEventHandler { [weak self] in
            guard self?.clientConnection?.open() == true else {
                return
            }
            
            timer.cancel()
        }
        
        timer.resume()
    }

    func startFrameTimer() {
        let timer = DispatchSource.makeTimerSource(queue: frameQueue)
        timer.schedule(deadline: .now(), repeating: Constants.frameInterval, leeway: .milliseconds(10))
        timer.setEventHandler { [weak self] in
            self?.sendLatestFrame()
        }
        frameTimer = timer
        timer.resume()
    }

    func stopFrameTimer() {
        frameTimer?.cancel()
        frameTimer = nil
        frameLock.lock()
        latestFrame = nil
        frameLock.unlock()
    }

    /// frameQueue only.
    func sendLatestFrame() {
        frameLock.lock()
        let frame = latestFrame
        let orientation = latestOrientation
        let frameId = latestFrameId
        frameLock.unlock()

        guard let frame = frame, let uploader = uploader else {
            return
        }
        let now = CACurrentMediaTime()
        guard frameId != sentFrameId || now - lastSentAt >= Constants.repeatInterval else {
            return
        }
        if uploader.send(imageBuffer: frame, orientation: orientation) {
            sentFrameId = frameId
            lastSentAt = now
        }
    }
}
