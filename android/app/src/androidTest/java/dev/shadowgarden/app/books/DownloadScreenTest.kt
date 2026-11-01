package dev.shadowgarden.app.books

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DownloadScreenTest {
    @get:Rule val composeRule = createComposeRule()

    @Test fun displaysStatusRetryAndCancellationActions() {
        val state = mutableStateOf(DownloadState(DownloadPhase.FAILED, "Could not save the EPUB."))
        var retries = 0
        var closed = 0
        composeRule.setContent { MaterialTheme { DownloadScreen("Fixture volume", state.value, null, { retries++ }, { closed++ }) } }
        composeRule.onNodeWithText("Fixture volume").assertIsDisplayed()
        composeRule.onNodeWithText("Could not save the EPUB.").assertIsDisplayed()
        composeRule.onNodeWithText("Retry download").performClick()
        assertEquals(1, retries)
        composeRule.runOnIdle { state.value = DownloadState(DownloadPhase.DOWNLOADING, "Downloading EPUB…") }
        composeRule.onNodeWithText("Keep this screen open. Downloads stop when the app leaves this screen.").assertIsDisplayed()
        composeRule.onNodeWithText("Cancel download").performClick()
        assertEquals(1, closed)
        composeRule.runOnIdle { state.value = DownloadState(DownloadPhase.SAVED, "Saved on this device.") }
        composeRule.onNodeWithText("Saved on this device.").assertIsDisplayed()
        composeRule.onNodeWithText("Back to series").assertIsDisplayed()
    }
}
