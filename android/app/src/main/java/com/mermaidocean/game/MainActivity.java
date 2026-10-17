package com.mermaidocean.game;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MermaidSpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
