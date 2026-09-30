Pod::Spec.new do |s|
  s.name           = 'CallAudio'
  s.version        = '1.0.0'
  s.summary        = 'Call audio session for SHEconomy meetings'
  s.description    = 'Configures the WebRTC AVAudioSession and audio routes for calls.'
  s.license        = 'MIT'
  s.author         = 'SHEconomy'
  s.homepage       = 'https://sheconomy.in'
  s.platforms      = { :ios => '15.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'JitsiWebRTC'

  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
