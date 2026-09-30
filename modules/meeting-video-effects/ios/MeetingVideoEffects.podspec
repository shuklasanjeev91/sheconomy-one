Pod::Spec.new do |s|
  s.name           = 'MeetingVideoEffects'
  s.version        = '1.0.0'
  s.summary        = 'On-device virtual backgrounds for SHEconomy meetings'
  s.description    = 'Vision/Core Image WebRTC frame processor exposed through Expo Modules.'
  s.license        = 'MIT'
  s.author         = 'SHEconomy'
  s.homepage       = 'https://sheconomy.in'
  s.platforms      = { :ios => '15.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'react-native-webrtc'
  s.dependency 'JitsiWebRTC'

  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
