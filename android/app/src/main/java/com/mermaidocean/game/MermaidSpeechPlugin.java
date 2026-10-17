package com.mermaidocean.game;

import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;

// Microphone audio stays in memory and is recognized entirely on the device.
@CapacitorPlugin(name = "MermaidSpeech", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class MermaidSpeechPlugin extends Plugin {
    private Model model;
    private Recognizer recognizer;
    private SpeechService service;
    private PluginCall stopCall;
    private StringBuilder fullText = new StringBuilder();

    @PluginMethod
    public void status(PluginCall call) {
        if (model != null) { resolveReady(call, true); return; }
        ActivityManager memory = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if (memory == null) { resolveReady(call, false); return; }
        ActivityManager.MemoryInfo info = new ActivityManager.MemoryInfo();
        memory.getMemoryInfo(info);
        if (memory.isLowRamDevice() || info.totalMem < 3L * 1024 * 1024 * 1024) {
            resolveReady(call, false);
            return;
        }
        // The model is part of the APK. StorageService copies it once to the
        // app's private files directory so Vosk's native library can open it.
        StorageService.unpack(getContext(), "vosk-fr", "models", loaded -> {
            model = loaded;
            resolveReady(call, true);
        }, error -> resolveReady(call, false));
    }

    private void resolveReady(PluginCall call, boolean ready) {
        JSObject result = new JSObject();
        result.put("ready", ready);
        call.resolve(result);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (model == null) { call.reject("Offline French model unavailable"); return; }
        if (service != null || stopCall != null) { call.reject("Microphone already active"); return; }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "onMicrophonePermission");
            return;
        }
        startRecording(call);
    }

    @PermissionCallback
    private void onMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission declined");
            return;
        }
        startRecording(call);
    }

    private void startRecording(PluginCall call) {
        try {
            fullText = new StringBuilder();
            recognizer = new Recognizer(model, 16000.0f);
            service = new SpeechService(recognizer, 16000.0f);
            if (!service.startListening(new RecognitionListener() {
                @Override public void onPartialResult(String result) {}
                @Override public void onResult(String result) { appendText(result); }
                @Override public void onFinalResult(String result) {
                    appendText(result);
                    finish(null);
                }
                @Override public void onError(Exception error) { finish(error.getMessage()); }
                @Override public void onTimeout() { finish(null); }
            })) {
                releaseRecorder();
                call.reject("Microphone already active");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            releaseRecorder();
            call.reject("Could not start offline microphone", error);
        }
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        if (service == null || stopCall != null) { call.reject("Microphone is not active"); return; }
        stopCall = call;
        if (!service.stop()) finish(null);
    }

    private void appendText(String json) {
        try {
            String text = new JSONObject(json).optString("text", "").trim();
            if (!text.isEmpty()) {
                if (fullText.length() > 0) fullText.append(' ');
                fullText.append(text);
            }
        } catch (Exception ignored) {}
    }

    private void finish(String error) {
        PluginCall call = stopCall;
        stopCall = null;
        if (error != null && service != null) service.cancel();
        releaseRecorder();
        if (call == null) return;
        if (error != null) call.reject(error);
        else {
            JSObject result = new JSObject();
            result.put("text", fullText.toString());
            call.resolve(result);
        }
    }

    private void releaseRecorder() {
        if (service != null) {
            service.shutdown();
            service = null;
        }
        if (recognizer != null) {
            recognizer.close();
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (service != null) service.cancel();
        releaseRecorder();
        if (model != null) { model.close(); model = null; }
    }
}
